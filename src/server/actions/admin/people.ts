'use server';

/**
 * ДЕЙСТВИЯ АДМИНКИ НАД ЛЮДЬМИ И СИСТЕМОЙ.
 *
 * Правила, зафиксированные ниже, — не перестраховка, а разбор конкретных
 * сценариев отказа:
 *
 *  • **Свой доступ менять нельзя.** Иначе первый же администратор, проверяющий
 *    «а что будет», снимает права себе и остаётся вне админки.
 *  • **Последнего активного администратора нельзя ни заблокировать, ни понизить.**
 *    Восстановление после этого возможно только через SQL на проде.
 *  • **Смена роли и блокировка пишутся в журнал.** Это операции, о которых
 *    спрашивают «кто это сделал», и ответ должен существовать.
 *  • **Матрица прав не может запретить что-либо администратору.** ADMIN не
 *    ограничивается по построению (`lib/auth/capabilities.ts`), и запись в
 *    матрице для него была бы обманом интерфейса.
 *  • **Грант не выдаётся на деньги и роли** (`nonGrantableCapabilities`) и живёт
 *    не дольше `grantLimits.maxMinutes`: «на два часа» — это решение поддержки,
 *    «навсегда» — решение о роли.
 *  • **Заявку не одобряет её автор.** Смысл второго администратора именно в этом.
 *  • **Экспорт проходит через `toCsv`.** Там уже закрыта formula injection: ячейка
 *    вида `=HYPERLINK(...)` из адреса клиента не должна исполняться в Excel
 *    бухгалтера.
 */

import { z } from 'zod';

import { grantLimits, isCapability, nonGrantableCapabilities } from '@/config/capabilities';
import { notificationTypes } from '@/config/notifications';
import { userRoles } from '@/domain/enums';
import { parseBulkCancelPayload } from '@/domain/booking/bulk-cancel';
import { domainErrors } from '@/domain/errors';
import { locales } from '@/i18n/config';
import type { Caller } from '@/lib/auth/guards';
import { markAuditReverted, recordAudit } from '@/lib/audit';
import { requireCapability } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { buildPreview } from '@/lib/notifications/preview';
import { toCsv } from '@/lib/security/export-safety';
import { cancelBookingAsStaff } from '@/server/booking/staff-cancel';
import { markInvoicePaid } from '@/server/corporate/service';
import { activeAdminCount, ordersForExport } from '@/server/admin/people';
import { authedAction } from '@/server/safe-action';

const idSchema = z.string().trim().min(1).max(64);
const capabilitySchema = z.string().trim().min(1).max(64).refine(isCapability, 'validation.required');

/* ───────────────────────────── Роль и доступ ───────────────────────────── */

export const changeUserRole = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.user.roleChange' })
  .inputSchema(z.object({ id: idSchema, role: z.enum(userRoles) }))
  .action(async ({ parsedInput, ctx }): Promise<{ role: string; requiresApproval?: boolean }> => {
    const caller = await requireCapability('users.roleChange');

    if (parsedInput.id === caller.id) throw domainErrors.forbidden();

    const before = await db.user.findUnique({
      where: { id: parsedInput.id },
      select: { id: true, role: true, isActive: true, email: true },
    });
    if (!before) throw domainErrors.notFound();

    /* Понижение последнего администратора запрещено — иначе админка запирается. */
    if (before.role === 'ADMIN' && parsedInput.role !== 'ADMIN' && (await activeAdminCount()) <= 1) {
      throw domainErrors.forbidden();
    }

    // Повышение до ADMIN/SUPPORT требует согласования вторым админом (maker-checker)
    const needsApproval = (parsedInput.role === 'ADMIN' || parsedInput.role === 'SUPPORT') && before.role !== parsedInput.role;
    if (needsApproval) {
      const { security } = await import('@/config/business');
      const existing = await db.approvalRequest.findFirst({
        where: { action: 'user.roleChange', status: 'PENDING', payload: { path: ['userId'], equals: parsedInput.id } } as never,
        select: { id: true, requestedById: true },
      } as never);
      if (existing) {
        if ((existing as { requestedById: string }).requestedById === caller.id) throw domainErrors.forbidden();
        await db.approvalRequest.update({ where: { id: (existing as { id: string }).id }, data: { status: 'APPROVED', decidedById: caller.id, decidedAt: new Date() } as never });
      } else {
        await db.approvalRequest.create({
          data: {
            action: 'user.roleChange',
            payload: { userId: parsedInput.id, role: parsedInput.role },
            requestedById: caller.id,
            expiresAt: new Date(Date.now() + security.guardrails.approvalTtlHours * 60 * 60 * 1000),
          } as never,
        });
        await recordAudit({ actor: caller, action: 'admin.user.roleChange.requested', entityType: 'User', entityId: parsedInput.id, after: { role: parsedInput.role }, ipAddress: ctx.identifier });
        return { role: before.role, requiresApproval: true };
      }
    }

    const after = await db.user.update({
      where: { id: parsedInput.id },
      data: { role: parsedInput.role },
      select: { id: true, role: true },
    });

    await recordAudit({
      actor: caller,
      action: 'admin.user.roleChange',
      entityType: 'User',
      entityId: parsedInput.id,
      before,
      after,
      ipAddress: ctx.identifier,
    });

    return { role: after.role };
  });

export const setUserActive = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.user.active' })
  .inputSchema(z.object({ id: idSchema, active: z.boolean() }))
  .action(async ({ parsedInput, ctx }): Promise<{ active: boolean }> => {
    const caller = await requireCapability('users.edit');

    if (parsedInput.id === caller.id) throw domainErrors.forbidden();

    const before = await db.user.findUnique({
      where: { id: parsedInput.id },
      select: { id: true, isActive: true, role: true },
    });
    if (!before) throw domainErrors.notFound();

    if (before.role === 'ADMIN' && !parsedInput.active && (await activeAdminCount()) <= 1) {
      throw domainErrors.forbidden();
    }

    const after = await db.user.update({
      where: { id: parsedInput.id },
      data: { isActive: parsedInput.active },
      select: { id: true, isActive: true },
    });

    /*
     * Блокировка обрывает и активные сессии: иначе человек остаётся в системе до
     * истечения cookie, а «доступ снят» на экране администратора — неправда.
     */
    if (!parsedInput.active) {
      await db.session.deleteMany({ where: { userId: parsedInput.id } });
    }

    await recordAudit({
      actor: caller,
      action: parsedInput.active ? 'admin.user.restore' : 'admin.user.suspend',
      entityType: 'User',
      entityId: parsedInput.id,
      before,
      after,
      ipAddress: ctx.identifier,
    });

    return { active: after.isActive };
  });

/**
 * Снятие блокировки второго фактора. Сбрасывает счётчик неверных кодов и
 * `lockedUntil`, отзывает доверенные устройства и открытые челленджи: после этого
 * следующий вход снова попросит код. Сессии не трогаем: пароль и вход остаются
 * как были, меняется только защита второго шага.
 */
export const resetUserTwoFactor = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.user.twoFactorReset' })
  .inputSchema(z.object({ id: idSchema }))
  .action(async ({ parsedInput, ctx }): Promise<{ reset: true }> => {
    const caller = await requireCapability('users.edit');

    if (parsedInput.id === caller.id) throw domainErrors.forbidden();

    const target = await db.user.findUnique({ where: { id: parsedInput.id }, select: { id: true } });
    if (!target) throw domainErrors.notFound();

    await db.$transaction([
      db.twoFactor.updateMany({
        where: { userId: parsedInput.id },
        data: { failedVerificationCount: 0, lockedUntil: null },
      }),
      db.verificationToken.deleteMany({
        where: { value: parsedInput.id, identifier: { startsWith: 'trust-device-' } },
      }),
      db.verificationToken.deleteMany({
        where: { value: parsedInput.id, identifier: { startsWith: '2fa-' } },
      }),
    ]);

    await recordAudit({
      actor: caller,
      action: 'admin.user.twoFactorReset',
      entityType: 'User',
      entityId: parsedInput.id,
      ipAddress: ctx.identifier,
    });

    return { reset: true };
  });

/* ─────────────────────────── Матрица и гранты ─────────────────────────── */

export const setRoleCapability = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.access.matrix' })
  .inputSchema(
    z.object({
      role: z.enum(userRoles),
      capability: capabilitySchema,
      enabled: z.boolean(),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<{ enabled: boolean }> => {
    const caller = await requireCapability('settings.edit');

    /* Администратора матрица не ограничивает — запись для него бессмысленна. */
    if (parsedInput.role === 'ADMIN') throw domainErrors.validationFailed('role');

    const row = await db.accessControl.upsert({
      where: { role_capability: { role: parsedInput.role, capability: parsedInput.capability } },
      create: {
        role: parsedInput.role,
        capability: parsedInput.capability,
        enabled: parsedInput.enabled,
        updatedById: caller.id,
      },
      update: { enabled: parsedInput.enabled, updatedById: caller.id },
      select: { id: true, enabled: true },
    });

    await recordAudit({
      actor: caller,
      action: 'admin.access.matrix',
      entityType: 'AccessControl',
      entityId: row.id,
      after: { role: parsedInput.role, capability: parsedInput.capability, enabled: parsedInput.enabled },
      ipAddress: ctx.identifier,
    });

    return { enabled: row.enabled };
  });

export const createAccessGrant = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.access.grant' })
  .inputSchema(
    z.object({
      role: z.enum(userRoles),
      capability: capabilitySchema,
      reason: z.string().trim().min(3).max(500),
      minutes: z.number().int().min(grantLimits.minMinutes).max(grantLimits.maxMinutes),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<{ id: string }> => {
    const caller = await requireCapability('settings.edit');

    if (parsedInput.role === 'ADMIN') throw domainErrors.validationFailed('role');

    /* Деньги и роли временным грантом не выдаются: это решение о роли. */
    if ((nonGrantableCapabilities as readonly string[]).includes(parsedInput.capability)) {
      throw domainErrors.validationFailed('capability');
    }

    const grant = await db.accessGrant.create({
      data: {
        role: parsedInput.role,
        capability: parsedInput.capability,
        reason: parsedInput.reason,
        grantedById: caller.id,
        expiresAt: new Date(Date.now() + parsedInput.minutes * 60 * 1000),
      },
      select: { id: true },
    });

    await recordAudit({
      actor: caller,
      action: 'admin.access.grant',
      entityType: 'AccessGrant',
      entityId: grant.id,
      after: {
        role: parsedInput.role,
        capability: parsedInput.capability,
        minutes: parsedInput.minutes,
      },
      reason: parsedInput.reason,
      ipAddress: ctx.identifier,
    });

    return { id: grant.id };
  });

export const revokeAccessGrant = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.access.revoke' })
  .inputSchema(z.object({ id: idSchema }))
  .action(async ({ parsedInput, ctx }): Promise<{ revoked: true }> => {
    const caller = await requireCapability('settings.edit');

    const grant = await db.accessGrant.findUnique({
      where: { id: parsedInput.id },
      select: { id: true, revokedAt: true, role: true, capability: true },
    });
    if (!grant) throw domainErrors.notFound();
    if (grant.revokedAt) return { revoked: true };

    await db.accessGrant.update({
      where: { id: parsedInput.id },
      data: { revokedAt: new Date() },
    });

    await recordAudit({
      actor: caller,
      action: 'admin.access.revoke',
      entityType: 'AccessGrant',
      entityId: grant.id,
      before: { role: grant.role, capability: grant.capability },
      ipAddress: ctx.identifier,
    });

    return { revoked: true };
  });

/* ──────────────────────────── Согласования ──────────────────────────── */

export const decideApproval = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.approval.decide' })
  .inputSchema(
    z.object({
      id: idSchema,
      approve: z.boolean(),
      note: z.string().trim().max(500).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<{ status: string }> => {
    const caller = await requireCapability('settings.edit');

    const request = await db.approvalRequest.findUnique({
      where: { id: parsedInput.id },
      select: { id: true, status: true, action: true, requestedById: true, expiresAt: true },
    });
    if (!request) throw domainErrors.notFound();
    if (request.status !== 'PENDING') throw domainErrors.validationFailed('status');

    /* Автор заявки не подтверждает её сам — в этом весь смысл второго админа. */
    if (request.requestedById === caller.id) throw domainErrors.forbidden();

    /* Просроченная заявка не выполняется: обстоятельств, в которых её просили, уже нет. */
    if (request.expiresAt.getTime() <= Date.now()) throw domainErrors.validationFailed('expiresAt');

    const status = parsedInput.approve ? 'APPROVED' : 'REJECTED';

    await db.approvalRequest.update({
      where: { id: parsedInput.id },
      data: {
        status,
        reviewedById: caller.id,
        reviewedAt: new Date(),
        ...(parsedInput.note ? { reviewNote: parsedInput.note } : {}),
      },
    });

    await recordAudit({
      actor: caller,
      action: 'admin.approval.decide',
      entityType: 'ApprovalRequest',
      entityId: request.id,
      before: { status: request.status },
      after: { status, action: request.action },
      ...(parsedInput.note ? { reason: parsedInput.note } : {}),
      ipAddress: ctx.identifier,
    });

    /*
     * Одобрение не только даёт разрешение, но и исполняет операцию — через тот же
     * платёжный адаптер, что и обычный возврат. Раньше здесь был ранний возврат
     * без исполнения: одобренная заявка оставалась «разрешением выполнить», а
     * фактической отправки денег не происходило. Теперь домен решает, что делать
     * с payload, а провайдер (сегодня — mock, завтра — банк из фазы 5) получает
     * обращение к шлюзу через единый интерфейс `PaymentProvider.refund`.
     */
    if (parsedInput.approve) {
      await executeApprovedRequest(request, caller, ctx.identifier).catch((error) => {
        console.error('[approval] исполнение после одобрения не удалось', {
          requestId: request.id,
          action: request.action,
          error,
        });
      });
    }

    return { status };
  });

/* ─────────────────────────── Откат по журналу ─────────────────────────── */

export const revertAuditEntry = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.audit.revert' })
  .inputSchema(z.object({ id: idSchema }))
  .action(async ({ parsedInput, ctx }): Promise<{ reverted: boolean }> => {
    const caller = await requireCapability('audit.view');
    await requireCapability('settings.edit');

    const entry = await db.auditLog.findUnique({
      where: { id: parsedInput.id },
      select: { id: true, diff: true, entityType: true, entityId: true, revertedAt: true, action: true },
    });
    if (!entry) throw domainErrors.notFound();
    if (entry.revertedAt) return { reverted: false };

    /*
     * Откат помечает запись откаченной и фиксирует намерение. Автоматического
     * восстановления значений здесь нет намеренно: `diff` обезличен (пароли и
     * токены заменены), и запись «[redacted]» обратно в БД была бы порчей данных.
     * Значения администратор возвращает формой раздела — уже зная, что было.
     */
    const marked = await markAuditReverted(entry.id, caller);

    await recordAudit({
      actor: caller,
      action: 'admin.audit.revert',
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: { auditId: entry.id, action: entry.action },
      ipAddress: ctx.identifier,
    });

    return { reverted: marked };
  });

/* ──────────────────────────────── Экспорт ──────────────────────────────── */

export interface ExportOutcome {
  filename: string;
  csv: string;
}

export const exportOrdersCsv = authedAction
  .metadata({ rateLimit: 'adminExport', audit: 'admin.export.orders' })
  .inputSchema(z.object({ range: z.enum(['30', '90', '365']) }))
  .action(async ({ parsedInput, ctx }): Promise<ExportOutcome> => {
    const caller = await requireCapability('data.export');

    const rows = await ordersForExport(parsedInput.range);

    /*
     * Заголовок — технические имена полей, а не переводы: файл уходит в
     * бухгалтерию и в скрипты, где «Итого» на трёх языках означает три разных
     * формата одного отчёта.
     */
    const csv = toCsv(
      [
        'order_number',
        'status',
        'contact_name',
        'contact_email',
        'subtotal',
        'discount_total',
        'delivery_fee',
        'vat_amount',
        'total',
        'placed_at',
        'paid_at',
      ],
      rows,
    );

    await recordAudit({
      actor: caller,
      action: 'admin.export.orders',
      entityType: 'Order',
      entityId: `range-${parsedInput.range}`,
      after: { rows: rows.length },
      ipAddress: ctx.identifier,
    });

    return { filename: `orders-${parsedInput.range}d.csv`, csv };
  });

/* ─────────────────────────────── Импорт CSV (E-03) ─────────────────────────────── */

const importKindSchema = z.enum([
  'classes',
  'instructors',
  'venues',
  'rooms',
  'products',
  'categories',
  'variants',
  'events',
  'promo-codes',
  'gift-cards',
  'blog-posts',
]);

export interface ImportOutcome {
  imported: number;
  errors: readonly { line: number; issues: readonly string[] }[];
}

export const importCatalogCsv = authedAction
  .metadata({ rateLimit: 'adminImport', audit: 'admin.import.catalog' })
  .inputSchema(z.object({ kind: importKindSchema, csvText: z.string().min(1).max(1_000_000) }))
  .action(async ({ parsedInput, ctx }): Promise<ImportOutcome> => {
    const caller = await requireCapability('catalog.edit');

    const { parseCsv } = await import('@/lib/files/csv');
    const { buildResourceSchema } = await import('@/domain/admin/schema');
    const { adminResourceSpecs } = await import('@/config/admin');
    const { createResource } = await import('@/server/admin/registry');

    const spec = adminResourceSpecs[parsedInput.kind as keyof typeof adminResourceSpecs];
    if (!spec) throw new Error('Unknown resource');

    const schema = buildResourceSchema(spec);
    const { rows, errors } = parseCsv(parsedInput.csvText, schema);

    if (errors.length > 0) {
      await recordAudit({
        actor: caller,
        action: 'admin.import.catalog.rejected',
        entityType: spec.model,
        entityId: parsedInput.kind,
        after: { errors: errors.length },
        ipAddress: ctx.identifier,
      });
      return { imported: 0, errors };
    }

    if (rows.length === 0) return { imported: 0, errors: [{ line: 1, issues: ['Пустой файл'] }] };

    // Лимит 1000 за импорт — защита от мегабайтного файла на проде.
    const batch = rows.slice(0, 1000);
    let imported = 0;
    for (const values of batch) {
      await createResource(parsedInput.kind as never, values as never);
      imported++;
    }

    await recordAudit({
      actor: caller,
      action: 'admin.import.catalog',
      entityType: spec.model,
      entityId: parsedInput.kind,
      after: { imported, errors: errors.length },
      ipAddress: ctx.identifier,
    });

    return { imported, errors: [] };
  });

/* ───────────────────── Предпросмотр писем (E-02) ───────────────────── */

export const sendPreviewEmail = authedAction
  .metadata({ rateLimit: 'adminExport', audit: 'admin.email.testSend' })
  .inputSchema(z.object({ type: z.enum(notificationTypes), locale: z.enum(locales) }))
  .action(async ({ parsedInput, ctx }): Promise<{ sent: boolean }> => {
    const caller = await requireCapability('settings.edit');
    const content = await buildPreview(parsedInput.type, parsedInput.locale);
    const result = await sendEmail({ to: caller.email, ...content });

    await recordAudit({
      actor: caller,
      action: 'admin.email.testSend',
      entityType: 'Email',
      entityId: `${parsedInput.type}:${parsedInput.locale}`,
      after: { sent: result.delivered },
      ipAddress: ctx.identifier,
    });

    return { sent: result.delivered };
  });

/* ─────────────────────── Исполнение одобренной заявки ─────────────────────── */

interface ApprovalRequestRef {
  id: string;
  action: string;
  requestedById: string;
}

/**
 * Одобренная массовая отмена. Каждая бронь отменяется отдельно, как одиночная: сбой одной
 * не останавливает остальные, и неудачи попадают в журнал. Право `bookings.cancel`
 * проверяется у одобрившего, а не у автора заявки: одобрение не расширяет чужие полномочия.
 */
async function executeBulkBookingCancel(
  request: ApprovalRequestRef,
  payload: unknown,
  approver: Caller,
  ipAddress: string | undefined,
): Promise<void> {
  const { security } = await import('@/config/business');
  const parsed = parseBulkCancelPayload(payload, security.guardrails.maxBulkActionItems);
  if (!parsed) {
    console.error('[approval] заявка на массовую отмену не прошла разбор', { requestId: request.id });
    return;
  }

  const { hasCapability } = await import('@/lib/auth/capabilities');
  if (!(await hasCapability(approver.role, 'bookings.cancel', approver.email))) {
    console.error('[approval] у одобрившего нет права bookings.cancel', { requestId: request.id });
    return;
  }

  const failed: string[] = [];
  for (const bookingId of parsed.bookingIds) {
    try {
      await cancelBookingAsStaff({
        id: bookingId,
        reason: parsed.reason,
        byProvider: parsed.byProvider,
        actor: approver,
        ipAddress,
      });
    } catch (error) {
      failed.push(bookingId);
      console.error('[approval] отмена брони не выполнена', { requestId: request.id, bookingId, error });
    }
  }

  await recordAudit({
    actor: approver,
    action: 'admin.booking.bulkCancel.executed',
    entityType: 'ApprovalRequest',
    entityId: request.id,
    after: { requested: parsed.bookingIds.length, failed },
    reason: parsed.reason,
    ipAddress,
  });
}

/**
 * Отметка оплаты счёта после одобрения второго админа. Баланс меняет только
 * `markInvoicePaid`; при неудаче он бросает ошибку, и `decideApproval` её логирует.
 */
async function executeCorporateInvoicePaid(
  request: ApprovalRequestRef,
  payload: unknown,
  approver: Caller,
  ipAddress: string | undefined,
): Promise<void> {
  const invoiceId = (payload as { invoiceId?: unknown } | null)?.invoiceId;
  if (typeof invoiceId !== 'string') {
    console.error('[approval] заявка на оплату счёта без счёта', { requestId: request.id });
    return;
  }

  const { hasCapability } = await import('@/lib/auth/capabilities');
  if (!(await hasCapability(approver.role, 'corporate.manage', approver.email))) {
    console.error('[approval] у одобрившего нет права corporate.manage', { requestId: request.id });
    return;
  }

  const invoice = await markInvoicePaid(invoiceId);

  await recordAudit({
    actor: approver,
    action: 'admin.corporate.invoice.paid',
    entityType: 'Invoice',
    entityId: invoice.id,
    after: { status: 'PAID', amount: invoice.amount, corporateAccountId: invoice.corporateAccountId },
    ipAddress,
  });
}

async function executeApprovedRequest(
  request: ApprovalRequestRef,
  approver: Caller,
  ipAddress: string | undefined,
): Promise<void> {
  const raw = await db.approvalRequest.findUnique({
    where: { id: request.id },
    select: { id: true, action: true, payload: true, status: true },
  });
  if (!raw || raw.status !== 'APPROVED') return;

  const payload = (raw.payload ?? {}) as Record<string, unknown>;

  if (raw.action === 'booking.bulkCancel') {
    await executeBulkBookingCancel(request, raw.payload, approver, ipAddress);
    return;
  }

  if (raw.action === 'corporate.invoice.markPaid') {
    await executeCorporateInvoicePaid(request, raw.payload, approver, ipAddress);
    return;
  }

  if (raw.action === 'payments.refund' || raw.action === 'payment.manualRefund') {
    const orderId = typeof payload.orderId === 'string' ? payload.orderId : null;
    const amount = typeof payload.amount === 'number' ? payload.amount : null;
    const reason = typeof payload.reason === 'string' ? payload.reason : 'maker-checker approval';
    if (!orderId || amount === null) return;

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        payments: {
          where: { status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } },
          select: { id: true, provider: true, providerTransactionId: true, paidAmount: true },
          orderBy: { createdAt: 'desc' },
        },
        refunds: { select: { amount: true, status: true, idempotencyKey: true } },
      },
    });
    if (!order) return;

    const payment = order.payments[0];
    if (!payment || !payment.providerTransactionId) return;

    const { money } = await import('@/domain/money');
    const { isRefundAllowed, refundableAmount } = await import('@/domain/admin/refund');
    const refundable = refundableAmount(payment.paidAmount, order.refunds);
    const normalized = money(amount);
    if (!isRefundAllowed(normalized, refundable)) return;

    const idempotencyKey = `approval-${raw.id}`;
    if (order.refunds.some((refund) => refund.idempotencyKey === idempotencyKey)) return;

    const created = await db.refund.create({
      data: {
        paymentId: payment.id,
        orderId: order.id,
        amount: normalized,
        reason,
        status: 'PENDING',
        idempotencyKey,
        initiatedBy: request.requestedById,
      },
      select: { id: true },
    });

    const { getPaymentProvider } = await import('@/lib/payments');
    const provider = getPaymentProvider(payment.provider as never);

    try {
      const result = await provider.refund({
        providerTransactionId: payment.providerTransactionId,
        amount: normalized,
        reason,
        idempotencyKey,
      });

      const finalStatus =
        result.status === 'REFUNDED' || result.status === 'PARTIALLY_REFUNDED' ? result.status : 'PENDING';

      await db.refund.update({
        where: { id: created.id },
        data: {
          providerRefundId: result.providerRefundId,
          status: finalStatus as never,
          providerPayload: result.raw as never,
        },
      });

      if (finalStatus === 'REFUNDED' || finalStatus === 'PARTIALLY_REFUNDED') {
        const refundedTotal = order.refunds
          .filter((entry) => ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(entry.status))
          .reduce((sum, entry) => sum + entry.amount, 0);
        const becomesRefunded = refundedTotal + normalized >= payment.paidAmount;
        await db.payment.update({
          where: { id: payment.id },
          data: { status: becomesRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
        });
      }
    } catch (error) {
      await db.refund.update({
        where: { id: created.id },
        data: {
          providerPayload: { error: error instanceof Error ? error.message : String(error) } as never,
        },
      });
      throw error;
    }

    await recordAudit({
      actor: approver,
      action: 'admin.order.refund.executed',
      entityType: 'Refund',
      entityId: created.id,
      after: { orderId, amount: normalized, approvalId: raw.id },
      reason,
      ipAddress,
    });
  }
}

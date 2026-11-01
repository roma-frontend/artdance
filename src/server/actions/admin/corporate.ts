'use server';

/**
 * КОРПОРАТИВНЫЕ СЧЕТА (B-06) — действия админки: аккаунт, выставленный счёт и
 * отметка оплаты переводом. Баланс меняется только в `markInvoicePaid`, и только
 * при переходе счёта из PENDING в PAID. Каждое действие пишет в журнал аудита.
 *
 * Отметка оплаты денежная, поэтому она не выполняется сразу: создаётся заявка на
 * согласование, и второй администратор подтверждает её на странице одобрений.
 * Исполняет заявку `decideApproval` (см. `actions/admin/people.ts`).
 */

import { z } from 'zod';

import { security } from '@/config/business';
import { domainErrors } from '@/domain/errors';
import { recordAudit } from '@/lib/audit';
import { requireCapability } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { createCorporateAccount, issueInvoice } from '@/server/corporate/service';
import { authedAction } from '@/server/safe-action';

export const createCorporateAccountAction = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.corporate.account.create' })
  .inputSchema(
    z.object({
      name: z.string().trim().min(2).max(120),
      contactEmail: z.string().trim().email().max(190),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<{ id: string }> => {
    const caller = await requireCapability('corporate.manage');
    const account = await createCorporateAccount(parsedInput);

    await recordAudit({
      actor: caller,
      action: 'admin.corporate.account.create',
      entityType: 'CorporateAccount',
      entityId: account.id,
      after: { name: account.name },
      ipAddress: ctx.identifier,
    });

    return { id: account.id };
  });

export const issueCorporateInvoiceAction = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.corporate.invoice.issue' })
  .inputSchema(
    z.object({
      corporateAccountId: z.string().trim().min(1).max(64),
      amount: z.number().int().positive().max(100_000_000),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<{ id: string; number: string }> => {
    const caller = await requireCapability('corporate.manage');
    const invoice = await issueInvoice({
      corporateAccountId: parsedInput.corporateAccountId,
      amount: parsedInput.amount,
    });

    await recordAudit({
      actor: caller,
      action: 'admin.corporate.invoice.issue',
      entityType: 'Invoice',
      entityId: invoice.id,
      after: { number: invoice.number, amount: invoice.amount, corporateAccountId: parsedInput.corporateAccountId },
      ipAddress: ctx.identifier,
    });

    return { id: invoice.id, number: invoice.number };
  });

export const markCorporateInvoicePaidAction = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.corporate.invoice.paidRequested' })
  .inputSchema(z.object({ id: z.string().trim().min(1).max(64) }))
  .action(async ({ parsedInput, ctx }): Promise<{ requestId: string }> => {
    const caller = await requireCapability('corporate.manage');
    const invoice = await db.invoice.findUnique({
      where: { id: parsedInput.id },
      select: { id: true, status: true, amount: true },
    });
    if (!invoice) throw domainErrors.notFound();
    if (invoice.status !== 'PENDING') throw domainErrors.validationFailed('status');

    /* Повторная заявка на тот же счёт не нужна: одна ждёт второго админа. */
    const pending = await db.approvalRequest.findFirst({
      where: {
        action: 'corporate.invoice.markPaid',
        status: 'PENDING',
        payload: { path: ['invoiceId'], equals: invoice.id },
      },
      select: { id: true },
    });
    if (pending) throw domainErrors.validationFailed('status');

    const request = await db.approvalRequest.create({
      data: {
        action: 'corporate.invoice.markPaid',
        payload: { invoiceId: invoice.id, amount: invoice.amount },
        requestedById: caller.id,
        expiresAt: new Date(Date.now() + security.guardrails.approvalTtlHours * 60 * 60 * 1000),
      },
      select: { id: true },
    });

    await recordAudit({
      actor: caller,
      action: 'admin.corporate.invoice.paidRequested',
      entityType: 'ApprovalRequest',
      entityId: request.id,
      after: { invoiceId: invoice.id, amount: invoice.amount },
      ipAddress: ctx.identifier,
    });

    return { requestId: request.id };
  });

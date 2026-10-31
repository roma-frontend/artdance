'use server';

/**
 * ДЕЙСТВИЯ АДМИНКИ НАД ОПЕРАЦИЯМИ — статусы, отмены, возвраты, выплаты, модерация.
 *
 * Здесь нет форм, только переходы состояний, и у каждого перехода своя цена
 * ошибки. Правила, которые зафиксированы в коде ниже:
 *
 *  • **Условия отмены берутся из брони, а не из конфига.** `Booking` хранит окно
 *    и ставку удержания на момент создания (`cancellationWindowHours`,
 *    `lateCancellationRate`). Спор через месяц решается тем, что записано в броне;
 *    изменение конфига не переписывает историю.
 *  • **Возврат считается от оплаченного, а не от суммы брони.** Клиент мог
 *    оплатить часть; возврат больше оплаченного — дыра в деньгах.
 *  • **Ручной возврат выше порога требует второго администратора.** Порог —
 *    `security.guardrails.maxManualRefund`; заявка уходит в `ApprovalRequest`, а
 *    не выполняется «на доверии».
 *  • **Возврат не выполняется у провайдера.** Пока адаптер банка не подключён
 *    (фаза 5), действие фиксирует `Refund` в состоянии PENDING и говорит об этом
 *    честно. Тихо помечать деньги возвращёнными нельзя: клиент их не получит.
 *  • **Модерация отзыва пересчитывает рейтинг в транзакции.** Денормализованные
 *    `ratingAverage`/`ratingCount` иначе разъезжаются с отзывами, и «4.8» на
 *    карточке перестаёт быть правдой.
 *  • **Выплата помечается отправленной только с правом `payouts.release`.** Это
 *    единственная операция, которая двигает деньги наружу.
 */

import { z } from 'zod';

import { security } from '@/config/business';
import { bookingStatuses, orderStatuses } from '@/domain/enums';
import { isRefundAllowed, refundableAmount, requiresApproval } from '@/domain/admin/refund';
import { domainErrors } from '@/domain/errors';
import { money } from '@/domain/money';
import { recordAudit } from '@/lib/audit';
import { requireCapability } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { settlePaidOrder } from '@/server/payments/settle';
import { cancelBookingAsStaff, type CancelBookingOutcome } from '@/server/booking/staff-cancel';
import { recordReliabilityEvent } from '@/server/reliability/service';
import { authedAction } from '@/server/safe-action';
import { decideVerificationDocument } from '@/server/verification/service';

/* ───────────────────────────── Статус заказа ───────────────────────────── */

/**
 * Разрешённые переходы. Список существует, чтобы «доставлен» нельзя было
 * поставить отменённому заказу: администратор нажимает не туда так же, как все.
 */
const orderTransitions: Record<string, readonly string[]> = {
  /* PAID ставит только вебхук или markCashCollected: иначе оплата без платежа и расчёта. */
  CREATED: ['CANCELLED'],
  PAID: ['PACKING', 'CANCELLED', 'RETURNED'],
  PACKING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

export const setOrderStatus = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.order.status' })
  .inputSchema(
    z.object({
      id: z.string().trim().min(1).max(64),
      status: z.enum(orderStatuses),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<{ status: string }> => {
    const caller = await requireCapability('orders.fulfil');

    const before = await db.order.findUnique({
      where: { id: parsedInput.id },
      select: { id: true, status: true, orderNumber: true },
    });
    if (!before) throw domainErrors.notFound();

    const allowed = orderTransitions[before.status] ?? [];
    if (!allowed.includes(parsedInput.status)) throw domainErrors.validationFailed('status');

    /* Метки времени переходов — часть истории заказа, а не производные от статуса. */
    const now = new Date();
    const stamps: Record<string, Date | null> = {};
    if (parsedInput.status === 'PAID') stamps.paidAt = now;
    if (parsedInput.status === 'SHIPPED') stamps.shippedAt = now;
    if (parsedInput.status === 'DELIVERED') stamps.deliveredAt = now;
    if (parsedInput.status === 'CANCELLED') stamps.cancelledAt = now;

    const after = await db.order.update({
      where: { id: parsedInput.id },
      data: { status: parsedInput.status, ...stamps },
      select: { id: true, status: true },
    });

    await recordAudit({
      actor: caller,
      action: 'admin.order.status',
      entityType: 'Order',
      entityId: parsedInput.id,
      before,
      after,
      ipAddress: ctx.identifier,
    });

    return { status: after.status };
  });

/* Наличные получены курьером: фиксируем платёж и запускаем расчёт. Статус заказа не меняется. */
export const markCashCollected = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.order.cash-collected' })
  .inputSchema(z.object({ id: z.string().trim().min(1).max(64) }))
  .action(async ({ parsedInput, ctx }): Promise<{ settled: boolean }> => {
    const caller = await requireCapability('orders.fulfil');

    const order = await db.order.findUnique({
      where: { id: parsedInput.id },
      select: { id: true, status: true, total: true, walletApplied: true, paidAt: true },
    });
    if (!order) throw domainErrors.notFound();
    if (!['PACKING', 'SHIPPED', 'DELIVERED'].includes(order.status)) throw domainErrors.validationFailed('status');

    const now = new Date();
    const idempotencyKey = `${order.id}:cod-collected`;
    const existing = await db.payment.findUnique({ where: { idempotencyKey }, select: { id: true } });

    if (!existing) {
      const cash = order.total - order.walletApplied;
      await db.$transaction([
        db.payment.create({
          data: {
            orderId: order.id,
            provider: 'cash-on-delivery',
            method: 'CASH_ON_DELIVERY',
            status: 'PAID',
            amount: cash,
            paidAmount: cash,
            idempotencyKey,
            paidAt: now,
          },
        }),
        db.order.update({ where: { id: order.id }, data: { paidAt: order.paidAt ?? now } }),
      ]);
    }

    /* Расчёт идемпотентен: повтор после сбоя доставит заказ, а не выдаст его второй раз. */
    const result = await settlePaidOrder(order.id, now);

    await recordAudit({
      actor: caller,
      action: 'admin.order.cash-collected',
      entityType: 'Order',
      entityId: order.id,
      before: { status: order.status },
      after: { settled: result.settled },
      ipAddress: ctx.identifier,
    });

    return { settled: result.settled };
  });

/* ─────────────────────────────── Возврат ─────────────────────────────── */

export interface RefundOutcome {
  /** Возврат зарегистрирован и ждёт провайдера. */
  registered: boolean;
  /** Операция ушла на согласование второму администратору. */
  requiresApproval: boolean;
}

export const refundOrder = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.order.refund' })
  .inputSchema(
    z.object({
      id: z.string().trim().min(1).max(64),
      amount: z.number().int().positive(),
      reason: z.string().trim().min(3).max(500),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<RefundOutcome> => {
    const caller = await requireCapability('payments.refund');

    const order = await db.order.findUnique({
      where: { id: parsedInput.id },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        payments: {
          where: { status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } },
          select: { id: true, paidAmount: true },
          orderBy: { createdAt: 'desc' },
        },
        refunds: { select: { amount: true, status: true } },
      },
    });
    if (!order) throw domainErrors.notFound();

    const payment = order.payments[0];
    if (!payment) throw domainErrors.refundNotAllowed();

    /*
     * Предел возврата — чистая функция в домене (`refundableAmount`), а не
     * арифметика по месту: это деньги, и она проверена тестами на второй
     * частичный возврат и на повторную попытку после отказа банка.
     */
    const refundable = refundableAmount(payment.paidAmount, order.refunds);
    const amount = money(parsedInput.amount);
    if (!isRefundAllowed(amount, refundable)) throw domainErrors.refundNotAllowed();

    /*
     * Порог ручного возврата. Выше него операция не выполняется, а становится
     * заявкой: второй администратор подтверждает её в разделе согласований.
     */
    if (requiresApproval(amount, security.guardrails.maxManualRefund)) {
      await db.approvalRequest.create({
        data: {
          action: 'payments.refund',
          payload: { orderId: order.id, amount, reason: parsedInput.reason },
          requestedById: caller.id,
          expiresAt: new Date(Date.now() + security.guardrails.approvalTtlHours * 60 * 60 * 1000),
        },
      });

      await recordAudit({
        actor: caller,
        action: 'admin.order.refund.requested',
        entityType: 'Order',
        entityId: order.id,
        after: { amount, reason: parsedInput.reason },
        ipAddress: ctx.identifier,
      });

      return { registered: false, requiresApproval: true };
    }

    await db.refund.create({
      data: {
        paymentId: payment.id,
        orderId: order.id,
        amount,
        reason: parsedInput.reason,
        /*
         * PENDING, а не REFUNDED: деньги возвращает провайдер, а адаптер банка
         * появится в фазе 5. Пометить возврат выполненным здесь значит соврать в
         * отчётности и в письме клиенту.
         */
        status: 'PENDING',
        idempotencyKey: `manual-${order.id}-${Date.now()}`,
        initiatedBy: caller.id,
      },
    });

    await recordAudit({
      actor: caller,
      action: 'admin.order.refund',
      entityType: 'Order',
      entityId: order.id,
      after: { amount, reason: parsedInput.reason },
      reason: parsedInput.reason,
      ipAddress: ctx.identifier,
    });

    return { registered: true, requiresApproval: false };
  });

/* ─────────────────────────────── Брони ─────────────────────────────── */

export const setBookingStatus = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.booking.status' })
  .inputSchema(
    z.object({
      id: z.string().trim().min(1).max(64),
      status: z.enum(bookingStatuses),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<{ status: string }> => {
    const caller = await requireCapability('bookings.edit');

    const before = await db.booking.findUnique({
      where: { id: parsedInput.id },
      select: { id: true, status: true, startsAt: true, customerId: true, instructor: { select: { userId: true } } },
    });
    if (!before) throw domainErrors.notFound();

    /* Отмена идёт через `cancelBooking`: там считается удержание и возврат. */
    if (parsedInput.status === 'CANCELLED_BY_CUSTOMER' || parsedInput.status === 'CANCELLED_BY_PROVIDER') {
      throw domainErrors.validationFailed('status');
    }

    const data: Record<string, unknown> = { status: parsedInput.status };
    if (parsedInput.status === 'COMPLETED') data.completedAt = new Date();

    const after = await db.booking.update({
      where: { id: parsedInput.id },
      data: data as { status: typeof parsedInput.status },
      select: { id: true, status: true },
    });

    // Только переход из CONFIRMED: отметка неподтверждённой брони не говорит ни о неявке, ни о проведении.
    if (before.status === 'CONFIRMED' && parsedInput.status === 'NO_SHOW') {
      // Неявка засчитывается клиенту: по правилам возврата неявка без отмены — его сторона.
      await recordReliabilityEvent({ userId: before.customerId, kind: 'NO_SHOW', refId: before.id });
    }
    if (before.status === 'CONFIRMED' && parsedInput.status === 'COMPLETED' && before.instructor) {
      // Проведение засчитывается инструктору; аренда без инструктора не засчитывается.
      await recordReliabilityEvent({ userId: before.instructor.userId, kind: 'COMPLETED', refId: before.id });
    }

    await recordAudit({
      actor: caller,
      action: 'admin.booking.status',
      entityType: 'Booking',
      entityId: parsedInput.id,
      before,
      after,
      ipAddress: ctx.identifier,
    });

    return { status: after.status };
  });

export const cancelBooking = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.booking.cancel' })
  .inputSchema(
    z.object({
      id: z.string().trim().min(1).max(64),
      reason: z.string().trim().min(3).max(500),
      /** Отмена по инициативе исполнителя — см. `cancelBookingAsStaff`. */
      byProvider: z.boolean(),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<CancelBookingOutcome> => {
    const caller = await requireCapability('bookings.cancel');
    return cancelBookingAsStaff({
      id: parsedInput.id,
      reason: parsedInput.reason,
      byProvider: parsedInput.byProvider,
      actor: caller,
      ipAddress: ctx.identifier,
    });
  });

/**
 * Массовая отмена — только заявкой. Отмена сразу нескольких броней (закрытие зала,
 * сорванная выездная группа) — тот же шаг, что одиночная отмена, но в масштабе,
 * поэтому второй администратор подтверждает список до того, как он станет отменами.
 * Исполнение — в `executeApprovedRequest` (`people.ts`).
 */
export const requestBulkBookingCancel = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.booking.bulkCancel.requested' })
  .inputSchema(
    z.object({
      ids: z.array(z.string().trim().min(1).max(64)).min(1).max(security.guardrails.maxBulkActionItems),
      reason: z.string().trim().min(3).max(500),
      byProvider: z.boolean(),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<{ count: number }> => {
    const caller = await requireCapability('bookings.cancel');
    const ids = [...new Set(parsedInput.ids)];

    const bookings = await db.booking.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } });
    if (bookings.length !== ids.length) throw domainErrors.notFound();
    if (bookings.some((b) => b.status === 'CANCELLED_BY_CUSTOMER' || b.status === 'CANCELLED_BY_PROVIDER')) {
      throw domainErrors.validationFailed('status');
    }

    const request = await db.approvalRequest.create({
      data: {
        action: 'booking.bulkCancel',
        payload: { bookingIds: ids, reason: parsedInput.reason, byProvider: parsedInput.byProvider },
        requestedById: caller.id,
        expiresAt: new Date(Date.now() + security.guardrails.approvalTtlHours * 60 * 60 * 1000),
      },
      select: { id: true },
    });

    await recordAudit({
      actor: caller,
      action: 'admin.booking.bulkCancel.requested',
      entityType: 'ApprovalRequest',
      entityId: request.id,
      after: { count: ids.length, byProvider: parsedInput.byProvider },
      reason: parsedInput.reason,
      ipAddress: ctx.identifier,
    });

    return { count: ids.length };
  });

/* ─────────────────────────────── Выплаты ─────────────────────────────── */

export const releasePayout = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.payout.release' })
  .inputSchema(
    z.object({
      id: z.string().trim().min(1).max(64),
      hold: z.boolean(),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<{ status: string }> => {
    const caller = await requireCapability('payouts.release');

    const before = await db.payout.findUnique({
      where: { id: parsedInput.id },
      select: { id: true, status: true, amount: true },
    });
    if (!before) throw domainErrors.notFound();

    if (before.status === 'PAID') throw domainErrors.validationFailed('status');

    // Maker-checker: выплата требует ApprovalRequest, кроме hold
    if (!parsedInput.hold) {
      const { security } = await import('@/config/business');
      if ((security.approvalRequiredActions as readonly string[]).includes('payout.release')) {
        const pending = await db.approvalRequest.findFirst({
          where: { action: 'payout.release', status: 'PENDING', payload: { path: ['payoutId'], equals: parsedInput.id } } as never,
          select: { id: true, requestedById: true },
        } as never);
        // Если есть ожидающая заявка от другого админа — исполняем только ей
        if (pending && (pending as { requestedById: string }).requestedById === caller.id) {
          throw domainErrors.validationFailed('status');
        }
        if (!pending) {
          await db.approvalRequest.create({
            data: {
              action: 'payout.release',
              payload: { payoutId: parsedInput.id },
              requestedById: caller.id,
              expiresAt: new Date(Date.now() + security.guardrails.approvalTtlHours * 60 * 60 * 1000),
            } as never,
          });
          await recordAudit({ actor: caller, action: 'admin.payout.release.requested', entityType: 'Payout', entityId: parsedInput.id, ipAddress: ctx.identifier });
          throw domainErrors.validationFailed('status');
        }
      }
    }

    const after = await db.payout.update({
      where: { id: parsedInput.id },
      data: parsedInput.hold
        ? { status: 'ON_HOLD' }
        : { status: 'PROCESSING', processedAt: new Date() },
      select: { id: true, status: true },
    });

    await recordAudit({
      actor: caller,
      action: parsedInput.hold ? 'admin.payout.hold' : 'admin.payout.release',
      entityType: 'Payout',
      entityId: parsedInput.id,
      before,
      after,
      ipAddress: ctx.identifier,
    });

    return { status: after.status };
  });

/* ────────────────────────────── Модерация ────────────────────────────── */

export const moderateItem = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.moderation.decide' })
  .inputSchema(
    z.object({
      kind: z.enum(['reviews', 'instructors', 'venues', 'instructors-verification']),
      id: z.string().trim().min(1).max(64),
      approve: z.boolean(),
      /** Причина видна автору: без неё отказ невозможно исправить. */
      reason: z.string().trim().max(500).optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<{ moderation: string }> => {
    const caller = await requireCapability(
      parsedInput.kind === 'reviews' ? 'reviews.moderate' : 'content.moderate',
    );

    if (!parsedInput.approve && (parsedInput.reason ?? '').trim().length < 3) {
      throw domainErrors.validationFailed('reason');
    }

    const moderation = parsedInput.approve ? 'APPROVED' : 'REJECTED';
    const now = new Date();

    if (parsedInput.kind === 'instructors-verification') {
      /* Статус документа и isVerified меняются одной транзакцией в сервисе верификации (D-02). */
      await decideVerificationDocument({
        documentId: parsedInput.id,
        decision: moderation,
        note: parsedInput.reason ?? null,
        actor: caller,
        ipAddress: ctx.identifier,
      });
      return { moderation };
    }

    if (parsedInput.kind === 'reviews') {
      const review = await db.review.findUnique({
        where: { id: parsedInput.id },
        select: { id: true, moderation: true, rating: true, instructorId: true, classId: true, productId: true, venueId: true },
      });
      if (!review) throw domainErrors.notFound();

      /*
       * Решение и пересчёт агрегатов — одна транзакция. Иначе одобренный отзыв
       * существует, а рейтинг его не учитывает, и «4.8» на карточке перестаёт
       * соответствовать отзывам под ней.
       */
      await db.$transaction(async (tx) => {
        await tx.review.update({
          where: { id: parsedInput.id },
          data: {
            moderation,
            moderatedById: caller.id,
            moderatedAt: now,
            ...(parsedInput.approve ? {} : { rejectionReason: parsedInput.reason ?? null }),
          },
        });

        if (review.instructorId) await recalcInstructorRating(tx, review.instructorId);
        if (review.venueId) await recalcVenueRating(tx, review.venueId);
        if (review.classId) await recalcClassRating(tx, review.classId);
        if (review.productId) await recalcProductRating(tx, review.productId);
      });

      await recordAudit({
        actor: caller,
        action: 'admin.review.moderate',
        entityType: 'Review',
        entityId: parsedInput.id,
        before: { moderation: review.moderation },
        after: { moderation },
        ...(parsedInput.reason ? { reason: parsedInput.reason } : {}),
        ipAddress: ctx.identifier,
      });

      return { moderation };
    }

    if (parsedInput.kind === 'instructors') {
      // Заявки с формы имеют префикс app: — это InstructorApplication, а не профиль.
      if (parsedInput.id.startsWith('app:')) {
        const appId = parsedInput.id.slice(4);
        const app = await db.instructorApplication.findUnique({
          where: { id: appId },
          select: { id: true, status: true, email: true, name: true },
        });
        if (!app) throw domainErrors.notFound();

        await db.instructorApplication.update({
          where: { id: appId },
          data: { status: moderation },
        });

        await recordAudit({
          actor: caller,
          action: parsedInput.approve ? 'admin.instructorApplication.approve' : 'admin.instructorApplication.reject',
          entityType: 'InstructorApplication',
          entityId: appId,
          before: { status: app.status },
          after: { status: moderation },
          ...(parsedInput.reason ? { reason: parsedInput.reason } : {}),
          ipAddress: ctx.identifier,
        });

        return { moderation };
      }

      const before = await db.instructorProfile.findUnique({
        where: { id: parsedInput.id },
        select: { id: true, moderation: true, publishedAt: true },
      });
      if (!before) throw domainErrors.notFound();

      await db.instructorProfile.update({
        where: { id: parsedInput.id },
        data: {
          moderation,
          /* Одобрение публикует профиль: иначе одобренный инструктор не в каталоге. */
          publishedAt: parsedInput.approve ? (before.publishedAt ?? now) : null,
        },
      });

      await recordAudit({
        actor: caller,
        action: 'admin.instructor.moderate',
        entityType: 'InstructorProfile',
        entityId: parsedInput.id,
        before,
        after: { moderation },
        ...(parsedInput.reason ? { reason: parsedInput.reason } : {}),
        ipAddress: ctx.identifier,
      });

      return { moderation };
    }

    const before = await db.venue.findUnique({
      where: { id: parsedInput.id },
      select: { id: true, moderation: true, publishedAt: true },
    });
    if (!before) throw domainErrors.notFound();

    await db.venue.update({
      where: { id: parsedInput.id },
      data: {
        moderation,
        publishedAt: parsedInput.approve ? (before.publishedAt ?? now) : null,
      },
    });

    await recordAudit({
      actor: caller,
      action: 'admin.venue.moderate',
      entityType: 'Venue',
      entityId: parsedInput.id,
      before,
      after: { moderation },
      ...(parsedInput.reason ? { reason: parsedInput.reason } : {}),
      ipAddress: ctx.identifier,
    });

    return { moderation };
  });

/* ────────────────────── Пересчёт денормализованных оценок ────────────────────── */

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function recalcInstructorRating(tx: Tx, instructorId: string): Promise<void> {
  const stats = await tx.review.aggregate({
    where: { instructorId, moderation: 'APPROVED' },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await tx.instructorProfile.update({
    where: { id: instructorId },
    data: {
      ratingAverage: stats._avg.rating ?? null,
      ratingCount: stats._count._all,
    },
  });
}

async function recalcVenueRating(tx: Tx, venueId: string): Promise<void> {
  const stats = await tx.review.aggregate({
    where: { venueId, moderation: 'APPROVED' },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await tx.venue.update({
    where: { id: venueId },
    data: { ratingAverage: stats._avg.rating ?? null, ratingCount: stats._count._all },
  });
}

async function recalcClassRating(tx: Tx, classId: string): Promise<void> {
  const stats = await tx.review.aggregate({
    where: { classId, moderation: 'APPROVED' },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await tx.danceClass.update({
    where: { id: classId },
    data: { ratingAverage: stats._avg.rating ?? null, ratingCount: stats._count._all },
  });
}

async function recalcProductRating(tx: Tx, productId: string): Promise<void> {
  const stats = await tx.review.aggregate({
    where: { productId, moderation: 'APPROVED' },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await tx.product.update({
    where: { id: productId },
    data: { ratingAverage: stats._avg.rating ?? null, ratingCount: stats._count._all },
  });
}

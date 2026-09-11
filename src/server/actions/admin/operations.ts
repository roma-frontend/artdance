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
import { cancellationOutcome, refundAmountFor } from '@/domain/booking/policy';
import { domainErrors } from '@/domain/errors';
import { money } from '@/domain/money';
import { recordAudit } from '@/lib/audit';
import { requireCapability } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { authedAction } from '@/server/safe-action';

/* ───────────────────────────── Статус заказа ───────────────────────────── */

/**
 * Разрешённые переходы. Список существует, чтобы «доставлен» нельзя было
 * поставить отменённому заказу: администратор нажимает не туда так же, как все.
 */
const orderTransitions: Record<string, readonly string[]> = {
  CREATED: ['PAID', 'CANCELLED'],
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
      select: { id: true, status: true, startsAt: true },
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

export interface CancelBookingOutcome {
  /** Удержание за позднюю отмену. */
  fee: number;
  /** Сумма к возврату клиенту. */
  refund: number;
}

export const cancelBooking = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.booking.cancel' })
  .inputSchema(
    z.object({
      id: z.string().trim().min(1).max(64),
      reason: z.string().trim().min(3).max(500),
      /**
       * Отмена по инициативе исполнителя. Разные статусы — разные последствия:
       * отмена площадкой не должна выглядеть как отказ клиента ни в отчётах, ни в
       * рейтинге.
       */
      byProvider: z.boolean(),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<CancelBookingOutcome> => {
    const caller = await requireCapability('bookings.cancel');

    const booking = await db.booking.findUnique({
      where: { id: parsedInput.id },
      select: {
        id: true,
        status: true,
        startsAt: true,
        totalPrice: true,
        cancellationWindowHours: true,
        lateCancellationRate: true,
        rescheduleWindowHours: true,
        maxReschedules: true,
        rescheduleCount: true,
        payments: { where: { status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } }, select: { paidAmount: true } },
      },
    });
    if (!booking) throw domainErrors.notFound();

    const outcome = cancellationOutcome(
      {
        startsAt: booking.startsAt,
        status: booking.status,
        totalPrice: booking.totalPrice,
        cancellationWindowHours: booking.cancellationWindowHours,
        lateCancellationRate: Number(booking.lateCancellationRate),
        rescheduleWindowHours: booking.rescheduleWindowHours,
        rescheduleCount: booking.rescheduleCount,
        maxReschedules: booking.maxReschedules,
      },
      new Date(),
    );

    /*
     * Администратор может отменить бронь, которую клиенту отменять уже нельзя
     * (началась, завершена) — это часть работы поддержки. Но удержание считается
     * по зафиксированным условиям, а не «по договорённости»: иначе в отчётности
     * появляются суммы, которых нет ни в одном правиле.
     */
    const paid = booking.payments.reduce((sum, payment) => sum + payment.paidAmount, 0);
    const fee = outcome.kind === 'fee' ? outcome.amount : 0;
    const refund = outcome.kind === 'forbidden' ? 0 : refundAmountFor(outcome, paid);

    const after = await db.booking.update({
      where: { id: parsedInput.id },
      data: {
        status: parsedInput.byProvider ? 'CANCELLED_BY_PROVIDER' : 'CANCELLED_BY_CUSTOMER',
        cancelledAt: new Date(),
        cancellationReason: parsedInput.reason,
      },
      select: { id: true, status: true, cancelledAt: true },
    });

    await recordAudit({
      actor: caller,
      action: 'admin.booking.cancel',
      entityType: 'Booking',
      entityId: parsedInput.id,
      before: { status: booking.status },
      after: { ...after, fee, refund },
      reason: parsedInput.reason,
      ipAddress: ctx.identifier,
    });

    return { fee, refund };
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
      kind: z.enum(['reviews', 'instructors', 'venues']),
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

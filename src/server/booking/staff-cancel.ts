/**
 * ОТМЕНА БРОНИ СОТРУДНИКОМ — общая часть одиночной и массовой отмены.
 *
 * Одиночная отмена из карточки брони и исполнение одобренной массовой отмены идут
 * через эту функцию: удержание, журнал и поздняя отмена считаются одинаково. Право
 * вызывающего проверяет действие, а не эта функция: исполнитель заявки проверяет его сам.
 */

import { cancellationOutcome, refundAmountFor } from '@/domain/booking/policy';
import { domainErrors } from '@/domain/errors';
import { isLateCancellation } from '@/domain/reliability';
import { recordAudit } from '@/lib/audit';
import type { Caller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { offerFreedSeat } from '@/server/booking/waitlist-offer';
import { recordReliabilityEvent } from '@/server/reliability/service';

export interface CancelBookingOutcome {
  /** Удержание за позднюю отмену. */
  fee: number;
  /** Сумма к возврату клиенту. */
  refund: number;
}

export interface CancelBookingInput {
  id: string;
  reason: string;
  /**
   * Отмена по инициативе исполнителя. Разные статусы — разные последствия:
   * отмена площадкой не должна выглядеть как отказ клиента ни в отчётах, ни в
   * рейтинге.
   */
  byProvider: boolean;
  actor: Caller;
  ipAddress?: string;
}

/**
 * Условия отмены берутся из брони, а не из конфига: окно и ставка записаны в момент
 * брони, поэтому спор через месяц решается по ним.
 */
export async function cancelBookingAsStaff(input: CancelBookingInput): Promise<CancelBookingOutcome> {
  const { id, reason, byProvider, actor, ipAddress } = input;

  const booking = await db.booking.findUnique({
    where: { id },
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
      updatedAt: true, sessionId: true, participants: true,
      customerId: true, instructor: { select: { userId: true } },
      payments: { where: { status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } }, select: { paidAmount: true } },
    },
  });
  if (!booking) throw domainErrors.notFound();

  const now = new Date();
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
    now,
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

  if (booking.status === 'CANCELLED_BY_CUSTOMER' || booking.status === 'CANCELLED_BY_PROVIDER') throw domainErrors.validationFailed('status');
  const after = await db.$transaction(async (tx) => {
    const claimed = await tx.booking.updateMany({
      where: { id: booking.id, status: booking.status, updatedAt: booking.updatedAt },
      data: {
        status: byProvider ? 'CANCELLED_BY_PROVIDER' : 'CANCELLED_BY_CUSTOMER',
        cancelledAt: new Date(), cancellationReason: reason,
      },
    });
    if (claimed.count !== 1) throw domainErrors.validationFailed('status');
    // Поздняя отмена засчитывается стороне, которая отменила: инструктору при byProvider, иначе клиенту.
    if (outcome.kind !== 'forbidden' && isLateCancellation({ now, startsAt: booking.startsAt, cancellationWindowHours: booking.cancellationWindowHours })) {
      const party = byProvider ? booking.instructor?.userId : booking.customerId;
      if (party) await recordReliabilityEvent({ userId: party, kind: 'LATE_CANCEL', refId: booking.id }, tx);
    }
    if (booking.sessionId && (booking.status === 'PENDING' || booking.status === 'CONFIRMED')) {
      const released = await tx.classSession.updateMany({
        where: { id: booking.sessionId, bookedCount: { gte: booking.participants } },
        data: { bookedCount: { decrement: booking.participants } },
      });
      if (released.count !== 1) throw domainErrors.validationFailed('sessionId');
    }
    if (outcome.kind === 'free' || (byProvider && outcome.kind !== 'forbidden')) {
      const redemption = await tx.classPassRedemption.findUnique({ where: { bookingId: booking.id } });
      if (redemption) {
        await tx.classPass.update({ where: { id: redemption.passId }, data: { lessonsRemaining: { increment: 1 } } });
        await tx.classPassRedemption.delete({ where: { id: redemption.id } });
      }
    }
    return tx.booking.findUniqueOrThrow({ where: { id: booking.id }, select: { id: true, status: true, cancelledAt: true } });
  });

  await recordAudit({
    actor,
    action: 'admin.booking.cancel',
    entityType: 'Booking',
    entityId: id,
    before: { status: booking.status },
    after: { ...after, fee, refund },
    reason,
    ipAddress,
  });

  // Место возвращается в занятие только для занятых броней; иначе очередь не трогаем.
  if (booking.sessionId && (booking.status === 'PENDING' || booking.status === 'CONFIRMED')) {
    await offerFreedSeat(booking.sessionId, now);
  }

  return { fee, refund };
}

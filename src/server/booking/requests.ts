/**
 * ЗАЯВКА НА БРОНЬ (D-04): ответ инструктора, истечение срока и напоминание.
 *
 * Открытая заявка — бронь PENDING с requestExpiresAt. ACCEPT переводит её в CONFIRMED;
 * DECLINE и истечение срока отменяют бронь и возвращают место и урок абонемента.
 * Оплата заявки здесь не учитывается: до включения правила нужно запретить оплату PENDING-заявки.
 */

import 'server-only';

import { booking } from '@/config/business';
import { requestCronAction, requestDueDedupeKey } from '@/domain/booking/request';
import { domainErrors } from '@/domain/errors';
import { isLateCancellation } from '@/domain/reliability';
import { db } from '@/lib/db';
import { notifyBookingCancelled, notifyBookingConfirmed, notifyBookingRequestDue } from '@/server/booking/notify';
import { recordReliabilityEvent } from '@/server/reliability/service';

/** Поля брони, по которым возвращаются место и урок абонемента. */
interface HeldSeats {
  id: string;
  sessionId: string | null;
  eventId: string | null;
  participants: number;
}

type CapacityTx = Pick<typeof db, 'classSession' | 'event' | 'classPass' | 'classPassRedemption'>;

/** Возврат мест и урока абонемента: та же логика, что в cancelBooking и expireUnpaidBookings. */
async function releaseCapacity(tx: CapacityTx, b: HeldSeats): Promise<void> {
  if (b.sessionId) {
    await tx.classSession.updateMany({
      where: { id: b.sessionId, bookedCount: { gte: b.participants } },
      data: { bookedCount: { decrement: b.participants } },
    });
  }
  if (b.eventId) {
    await tx.event.updateMany({
      where: { id: b.eventId, bookedCount: { gte: b.participants } },
      data: { bookedCount: { decrement: b.participants } },
    });
  }
  const redemption = await tx.classPassRedemption.findUnique({
    where: { bookingId: b.id },
    select: { id: true, passId: true },
  });
  if (redemption) {
    await tx.classPass.update({ where: { id: redemption.passId }, data: { lessonsRemaining: { increment: 1 } } });
    await tx.classPassRedemption.delete({ where: { id: redemption.id } });
  }
}

export interface RespondToBookingRequestInput {
  bookingId: string;
  /** InstructorProfile.id: заявку решает только инструктор этой брони. */
  instructorId: string;
  decision: 'ACCEPT' | 'DECLINE';
  reason?: string;
  now: Date;
}

/**
 * Ответ инструктора на заявку. Повторный ответ и ответ после срока отклоняются.
 * Отказ не передаёт место следующему из листа ожидания.
 */
export async function respondToBookingRequest(
  input: RespondToBookingRequestInput,
): Promise<{ status: 'CONFIRMED' | 'CANCELLED_BY_PROVIDER' }> {
  const b = await db.booking.findFirst({
    where: { id: input.bookingId, instructorId: input.instructorId },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      requestExpiresAt: true,
      sessionId: true,
      eventId: true,
      participants: true,
      startsAt: true,
      cancellationWindowHours: true,
      instructor: { select: { userId: true } },
    },
  });
  if (!b) throw domainErrors.notFound();
  if (b.status !== 'PENDING' || b.requestExpiresAt === null) throw domainErrors.bookingRequestNotPending();
  if (b.requestExpiresAt.getTime() <= input.now.getTime()) throw domainErrors.bookingRequestExpired();

  const accepted = input.decision === 'ACCEPT';
  const claim = { id: b.id, status: 'PENDING' as const, updatedAt: b.updatedAt };
  await db.$transaction(async (tx) => {
    // Compare-and-set: если заявку уже решили или cron её истёк, второй ответ не применяем.
    const claimed = accepted
      ? await tx.booking.updateMany({ where: claim, data: { status: 'CONFIRMED', requestExpiresAt: null } })
      : await tx.booking.updateMany({
          where: claim,
          data: {
            status: 'CANCELLED_BY_PROVIDER',
            cancelledAt: input.now,
            cancellationReason: input.reason ?? 'REQUEST_DECLINED',
          },
        });
    if (claimed.count !== 1) throw domainErrors.bookingRequestNotPending();
    if (!accepted) await releaseCapacity(tx, b);
    // Отказ инструктора — его отмена: поздний отказ засчитывается ему в этой же транзакции.
    if (!accepted && b.instructor && isLateCancellation({ now: input.now, startsAt: b.startsAt, cancellationWindowHours: b.cancellationWindowHours })) {
      await recordReliabilityEvent({ userId: b.instructor.userId, kind: 'LATE_CANCEL', refId: b.id }, tx);
    }
  });

  if (accepted) void notifyBookingConfirmed(b.id).catch(() => {});
  else void notifyBookingCancelled(b.id, 0).catch(() => {});
  return { status: accepted ? 'CONFIRMED' : 'CANCELLED_BY_PROVIDER' };
}

/** Заявки инструктора, которые ещё ждут ответа: самая срочная сверху. */
export function listOpenBookingRequests(instructorId: string, now: Date) {
  return db.booking.findMany({
    where: { instructorId, status: 'PENDING', requestExpiresAt: { gt: now } },
    orderBy: { requestExpiresAt: 'asc' },
    select: {
      id: true,
      subject: true,
      startsAt: true,
      endsAt: true,
      participants: true,
      requestExpiresAt: true,
      customer: { select: { name: true } },
      session: { select: { danceClass: { select: { title: true } } } },
    },
  });
}

/** Открытые заявки: PENDING с заданным сроком ответа. */
function openRequests() {
  return db.booking.findMany({
    where: { status: 'PENDING', requestExpiresAt: { not: null } },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      requestExpiresAt: true,
      sessionId: true,
      eventId: true,
      participants: true,
      instructor: { select: { userId: true } },
    },
  });
}

/**
 * Истечение заявок, на которые инструктор не ответил до срока.
 * Бронь переходит в EXPIRED, место возвращается, клиент получает письмо об отмене без возврата.
 */
export async function expireBookingRequests(now: Date): Promise<{ expired: number }> {
  let expired = 0;
  for (const b of await openRequests()) {
    const action = requestCronAction({
      status: b.status,
      requestExpiresAt: b.requestExpiresAt,
      createdAt: b.createdAt,
      slaHours: booking.requestResponseSlaHours,
      now,
    });
    if (action !== 'EXPIRE') continue;
    const claimed = await db.$transaction(async (tx) => {
      // Compare-and-set: заявку могли уже принять или отклонить.
      const result = await tx.booking.updateMany({
        where: { id: b.id, status: 'PENDING', updatedAt: b.updatedAt },
        data: { status: 'EXPIRED', cancellationReason: 'REQUEST_TIMEOUT' },
      });
      if (result.count !== 1) return false;
      await releaseCapacity(tx, b);
      return true;
    });
    if (!claimed) continue;
    expired += 1;
    void notifyBookingCancelled(b.id, 0).catch(() => {});
  }
  return { expired };
}

/**
 * Напоминание инструктору о заявке, которая ждёт ответа дольше SLA.
 * Одно письмо на заявку: проверка по ключу в payload, а не по последним письмам,
 * потому что notify смотрит только 20 последних уведомлений типа.
 */
export async function remindBookingRequests(now: Date): Promise<{ reminded: number }> {
  let reminded = 0;
  for (const b of await openRequests()) {
    if (!b.instructor || !b.requestExpiresAt) continue;
    const action = requestCronAction({
      status: b.status,
      requestExpiresAt: b.requestExpiresAt,
      createdAt: b.createdAt,
      slaHours: booking.requestResponseSlaHours,
      now,
    });
    if (action !== 'REMIND') continue;
    const alreadySent = await db.notification.findFirst({
      where: {
        userId: b.instructor.userId,
        type: 'booking.requestDue',
        payload: { path: ['dedupeKey'], equals: requestDueDedupeKey(b.id) },
      },
      select: { id: true },
    });
    if (alreadySent) continue;
    const sent = await notifyBookingRequestDue(b.id, b.instructor.userId, b.requestExpiresAt).catch(() => false);
    if (sent) reminded += 1;
  }
  return { reminded };
}

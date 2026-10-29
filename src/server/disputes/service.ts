import 'server-only';

import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { disputeLoserId, disputeOpenable, disputeValidReason, type DisputeWinner } from '@/domain/dispute';
import { recordReliabilityEvent } from '@/server/reliability/service';

/** Участник брони: клиент, инструктор или участник площадки. Администратор решает и не участвует. */
async function isBookingParticipant(
  userId: string,
  booking: { customerId: string; venueId: string | null; instructor: { userId: string } | null },
): Promise<boolean> {
  if (booking.customerId === userId) return true;
  if (booking.instructor?.userId === userId) return true;
  if (!booking.venueId) return false;
  const membership = await db.venueMember.findUnique({
    where: { venueId_userId: { venueId: booking.venueId, userId } },
    select: { id: true },
  });
  return membership !== null;
}

/**
 * Открыть спор. Только участник брони и только когда спор по ней уместен (`disputeOpenable`).
 * Второй спор по той же брони — ошибка: `bookingId` в `Dispute` уникален.
 */
export async function openDispute(input: { bookingId: string; reason: string; openedBy: string; now?: Date }) {
  const reason = input.reason.trim();
  if (!disputeValidReason(reason)) throw domainErrors.validationFailed('reason');

  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      status: true,
      endsAt: true,
      customerId: true,
      venueId: true,
      instructor: { select: { userId: true } },
    },
  });
  if (!booking) throw domainErrors.notFound();
  if (!(await isBookingParticipant(input.openedBy, booking))) throw domainErrors.forbidden();
  if (!disputeOpenable({ status: booking.status, endsAt: booking.endsAt }, input.now ?? new Date())) {
    throw domainErrors.validationFailed('bookingId');
  }

  try {
    return await db.dispute.create({ data: { bookingId: input.bookingId, reason, openedBy: input.openedBy } });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') throw domainErrors.validationFailed('bookingId');
    throw e;
  }
}

/**
 * Решение модератора. Переход только из PENDING: решённый спор не переписывается.
 * Смена статуса и штраф — в одной транзакции: не бывает решённого спора без записи о проигрыше
 * и штрафа без решения. Штраф идемпотентен через `refId` = id спора.
 */
export async function resolveDispute(input: { disputeId: string; winner: DisputeWinner }) {
  const dispute = await db.dispute.findUnique({
    where: { id: input.disputeId },
    select: {
      status: true,
      openedBy: true,
      booking: { select: { customerId: true, instructor: { select: { userId: true } } } },
    },
  });
  if (!dispute) throw domainErrors.notFound();
  if (dispute.status !== 'PENDING') throw domainErrors.validationFailed('status');

  const loserId = disputeLoserId(
    input.winner,
    { customerId: dispute.booking.customerId, instructorUserId: dispute.booking.instructor?.userId ?? null },
    dispute.openedBy,
  );
  const status = input.winner === 'CLAIMANT' ? 'APPROVED' : 'REJECTED';

  return db.$transaction(async (tx) => {
    // Compare-and-set: при гонке двух модераторов второе решение не пройдёт и штраф не начислится дважды.
    const { count } = await tx.dispute.updateMany({
      where: { id: input.disputeId, status: 'PENDING' },
      data: { status },
    });
    if (count === 0) throw domainErrors.validationFailed('status');
    if (loserId) {
      await recordReliabilityEvent({ userId: loserId, kind: 'DISPUTE_LOST', refId: input.disputeId }, tx);
    }
    return tx.dispute.findUniqueOrThrow({ where: { id: input.disputeId } });
  });
}

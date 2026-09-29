import 'server-only';

import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { disputeValidReason } from '@/domain/dispute';
import { recordReliabilityEvent } from '@/server/reliability/service';

export async function openDispute(input: { bookingId: string; reason: string; openedBy: string }) {
  const reason = input.reason.trim();
  if (!disputeValidReason(reason)) throw domainErrors.validationFailed('reason');
  const booking = await db.booking.findUnique({ where: { id: input.bookingId } });
  if (!booking) throw domainErrors.notFound();
  try {
    return await db.dispute.create({ data: { bookingId: input.bookingId, reason, openedBy: input.openedBy } });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') throw domainErrors.validationFailed('bookingId');
    throw e;
  }
}

export async function resolveDispute(input: { disputeId: string; winner: 'CLAIMANT' | 'RESPONDENT' }) {
  const dispute = await db.dispute.findUnique({ where: { id: input.disputeId } });
  if (!dispute) throw domainErrors.notFound();
  const status = input.winner === 'CLAIMANT' ? 'APPROVED' : 'REJECTED';
  const updated = await db.dispute.update({ where: { id: input.disputeId }, data: { status } });
  // Loser gets reliability hit
  const loserId = input.winner === 'CLAIMANT'
    ? (await db.booking.findUnique({ where: { id: (dispute as unknown as { bookingId: string }).bookingId }, select: { customerId: true } } as never) as unknown as { customerId: string } | null)?.customerId ?? null
    : (dispute as unknown as { openedBy: string }).openedBy;
  if (loserId) await recordReliabilityEvent({ userId: loserId, kind: 'DISPUTE_LOST', refId: (dispute as unknown as { id: string }).id });
  return updated;
}

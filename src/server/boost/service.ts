import 'server-only';

import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { boostBidValid } from '@/domain/boost';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';

async function assertBoostEnabled(): Promise<void> {
  await assertEntitlementOrThrow('boost');
}

export async function createBoost(input: { instructorId: string; bidAmount: number; startsAt: Date; endsAt: Date }) {
  await assertBoostEnabled();
  if (!boostBidValid(input.bidAmount)) throw domainErrors.validationFailed('bidAmount');
  if (input.endsAt.getTime() <= input.startsAt.getTime()) throw domainErrors.validationFailed('endsAt');
  return db.boostCampaign.create({
    data: { instructorId: input.instructorId, bidAmount: input.bidAmount, startsAt: input.startsAt, endsAt: input.endsAt },
    select: { id: true },
  });
}

export async function approveBoost(campaignId: string) {
  await assertBoostEnabled();
  return db.boostCampaign.update({ where: { id: campaignId }, data: { status: 'APPROVED' } });
}

export async function activeBoosts(now: Date) {
  if (!(await getEffectiveEntitlementsSafe()).boost) return [] as { instructorId: string }[];
  return db.boostCampaign.findMany({ where: { status: 'APPROVED', startsAt: { lte: now }, endsAt: { gt: now } } as never, select: { instructorId: true } });
}

import 'server-only';

import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { boostBidValid } from '@/domain/boost';

async function assertBoostEnabled(): Promise<void> {
  try {
    const { isEntitlementEnabled } = await import('@/server/entitlements/service');
    const enabled = await isEntitlementEnabled('boost').catch(() => true);
    if (!enabled) throw domainErrors.featureDisabled();
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === 'FEATURE_DISABLED') throw error;
  }
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
  try {
    const { isEntitlementEnabled } = await import('@/server/entitlements/service');
    const enabled = await isEntitlementEnabled('boost').catch(() => true);
    if (!enabled) return [] as { instructorId: string }[];
  } catch {}
  return db.boostCampaign.findMany({ where: { status: 'APPROVED', startsAt: { lte: now }, endsAt: { gt: now } } as never, select: { instructorId: true } });
}

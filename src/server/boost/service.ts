import 'server-only';

import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { boostBidValid } from '@/domain/boost';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';

async function assertBoostEnabled(): Promise<void> {
  await assertEntitlementOrThrow('boost');
}

/** Заявка инструктора на промо-размещение. Не действует, пока администратор её не одобрит. */
export async function createBoost(input: { instructorId: string; bidAmount: number; startsAt: Date; endsAt: Date }) {
  await assertBoostEnabled();
  if (!boostBidValid(input.bidAmount)) throw domainErrors.validationFailed('bidAmount');
  if (input.endsAt.getTime() <= input.startsAt.getTime()) throw domainErrors.validationFailed('endsAt');
  return db.boostCampaign.create({
    data: { instructorId: input.instructorId, bidAmount: input.bidAmount, startsAt: input.startsAt, endsAt: input.endsAt },
    select: { id: true },
  });
}

/**
 * Одобрение кампании поднимает `InstructorProfile.boostedUntil` до конца кампании: именно
 * это поле читает ранжирование выдачи. Раньше одобрение его не трогало, и буст не
 * влиял ни на что. Срок не уменьшается: более длинная кампания не сокращается короткой.
 */
export async function approveBoost(campaignId: string) {
  await assertBoostEnabled();
  return db.$transaction(async (tx) => {
    const campaign = await tx.boostCampaign.update({
      where: { id: campaignId },
      data: { status: 'APPROVED' },
      select: { instructorId: true, endsAt: true },
    });
    const profile = await tx.instructorProfile.findUniqueOrThrow({
      where: { id: campaign.instructorId },
      select: { boostedUntil: true },
    });
    if (!profile.boostedUntil || profile.boostedUntil.getTime() < campaign.endsAt.getTime()) {
      await tx.instructorProfile.update({
        where: { id: campaign.instructorId },
        data: { boostedUntil: campaign.endsAt },
      });
    }
    return campaign;
  });
}

export async function rejectBoost(campaignId: string) {
  await assertBoostEnabled();
  return db.boostCampaign.update({ where: { id: campaignId }, data: { status: 'REJECTED' }, select: { id: true } });
}

/** Кампании инструктора для его экрана: новые сверху. */
export async function instructorBoosts(instructorId: string) {
  return db.boostCampaign.findMany({
    where: { instructorId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, status: true, bidAmount: true, startsAt: true, endsAt: true, createdAt: true },
  });
}

/** Заявки для модерации: сначала ожидающие, потом остальные. */
export async function boostCampaignsForModeration() {
  const rows = await db.boostCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      status: true,
      bidAmount: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      instructor: { select: { id: true, user: { select: { name: true } } } },
    },
  });
  const rank: Record<string, number> = { PENDING: 0, APPROVED: 1, REJECTED: 2 };
  return rows.sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3));
}

export async function activeBoosts(now: Date) {
  if (!(await getEffectiveEntitlementsSafe()).boost) return [] as { instructorId: string }[];
  return db.boostCampaign.findMany({ where: { status: 'APPROVED', startsAt: { lte: now }, endsAt: { gt: now } } as never, select: { instructorId: true } });
}

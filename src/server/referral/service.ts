import 'server-only';

import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { creditWallet } from '@/server/wallet/service';

const BONUS = 3000; // AMD, единый бонус обеим сторонам — измеримый CAC, без процентов

function codeFor(userId: string): string {
  return userId.slice(-8).toUpperCase();
}

export async function ensureReferralCode(callerId: string): Promise<string> {
  const code = codeFor(callerId);
  await db.referral.upsert({
    where: { referrerId_code: { referrerId: callerId, code } } as never,
    create: { referrerId: callerId, code, refereeId: null } as never,
    update: {},
  });
  return code;
}

export async function bindReferral(input: { refereeId: string; code: string }) {
  const normalized = input.code.trim().toUpperCase();
  const referral = await db.referral.findFirst({ where: { code: normalized } } as never);
  if (!referral) throw domainErrors.notFound();
  const r = referral as unknown as { referrerId: string; refereeId: string | null; id: string };
  if (r.referrerId === input.refereeId) throw domainErrors.validationFailed('code');
  if (r.refereeId) throw domainErrors.validationFailed('code');
  const existing = await db.referral.findFirst({ where: { refereeId: input.refereeId } } as never);
  if (existing) throw domainErrors.validationFailed('code');
  await db.referral.update({ where: { id: r.id }, data: { refereeId: input.refereeId } as never });
  return { referrerId: r.referrerId, id: r.id };
}

export async function payReferralBonus(referralId: string) {
  const referral = await db.referral.findUnique({ where: { id: referralId } } as never);
  if (!referral) throw domainErrors.notFound();
  const r = referral as unknown as { referrerId: string; refereeId: string | null; bonusPaidAt: Date | null; id: string };
  if (!r.refereeId || r.bonusPaidAt) return null;
  const referrerBonus = await creditWallet({ userId: r.referrerId, amount: BONUS, kind: 'CREDIT_REFERRAL', refId: `referral:${r.id}:referrer` });
  const refereeBonus = await creditWallet({ userId: r.refereeId, amount: BONUS, kind: 'CREDIT_REFERRAL', refId: `referral:${r.id}:referee` });
  if (!referrerBonus.idempotent) {
    await db.referral.update({ where: { id: r.id }, data: { bonusPaidAt: new Date() } as never });
  }
  void refereeBonus;
  return { bonus: BONUS };
}

export const referralBonusAmount = BONUS;

import 'server-only';

import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { creditWallet } from '@/server/wallet/service';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';

const BONUS = 3000; // AMD, единый бонус обеим сторонам — измеримый CAC, без процентов

async function assertReferralsEnabled(): Promise<void> {
  await assertEntitlementOrThrow('referrals');
}

function codeFor(userId: string): string {
  return userId.slice(-8).toUpperCase();
}

export async function ensureReferralCode(callerId: string): Promise<string> {
  await assertReferralsEnabled();
  const code = codeFor(callerId);
  await db.referral.upsert({
    where: { referrerId_code: { referrerId: callerId, code } } as never,
    create: { referrerId: callerId, code, refereeId: null } as never,
    update: {},
  });
  return code;
}

export async function bindReferral(input: { refereeId: string; code: string }) {
  await assertReferralsEnabled();
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

/**
 * Выплата бонуса по уже привязанному рефералу.
 *
 * `deliverOnly` — вызов из доставки оплаченного заказа: бонус обещан человеку,
 * который уже заплатил, и выключение модуля после этого не отменяет обещания.
 */
export async function payReferralBonus(referralId: string, options?: { deliverOnly?: boolean }) {
  if (!options?.deliverOnly) await assertReferralsEnabled();
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

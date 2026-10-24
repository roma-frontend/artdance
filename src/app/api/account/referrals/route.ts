/**
 * API: GET /api/account/referrals — реферальный код, размер бонуса и приглашённые клиента.
 *
 * Личность только из серверной сессии. Код заводится при первом запросе, как и на
 * странице. Тумблер `referrals` проверяется внутри `ensureReferralCode`.
 * Бонус «выплачено» отдаётся только если он реально выплачен (`bonusPaidAt`).
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { domainErrors, httpStatusFor, isDomainError } from '@/domain/errors';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { ensureReferralCode, referralBonusAmount } from '@/server/referral/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none } });
}

export async function GET() {
  try {
    await assertEntitlementOrThrow('referrals');
    const caller = await getCaller();
    if (!caller) throw domainErrors.unauthorized();

    const code = await ensureReferralCode(caller.id);
    const invited = await db.referral.findMany({
      where: { referrerId: caller.id, refereeId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, createdAt: true, bonusPaidAt: true },
    });

    return json(
      {
        code,
        bonusAmount: referralBonusAmount,
        invited: invited.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          bonusPaid: r.bonusPaidAt !== null,
        })),
      },
      200,
    );
  } catch (e) {
    if (isDomainError(e)) return json({ error: e.code, messageKey: e.messageKey, params: e.params }, httpStatusFor(e.code));
    console.error('[account/referrals]', e);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
  }
}

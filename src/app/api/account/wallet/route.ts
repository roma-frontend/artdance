/**
 * API: GET /api/account/wallet — баланс кошелька и последние проводки клиента.
 *
 * Личность только из серверной сессии. Тумблер `wallet` проверяется так же, как
 * на странице: выключенный модуль отвечает `FEATURE_DISABLED`.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { domainErrors, httpStatusFor, isDomainError } from '@/domain/errors';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none } });
}

export async function GET() {
  try {
    await assertEntitlementOrThrow('wallet');
    const caller = await getCaller();
    if (!caller) throw domainErrors.unauthorized();

    const account = await db.walletAccount.findUnique({
      where: { userId: caller.id },
      select: {
        balance: true,
        entries: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, amount: true, kind: true, createdAt: true },
        },
      },
    });

    return json(
      {
        balance: account?.balance ?? 0,
        entries: (account?.entries ?? []).map((e) => ({
          id: e.id,
          amount: e.amount,
          kind: e.kind,
          createdAt: e.createdAt.toISOString(),
        })),
      },
      200,
    );
  } catch (e) {
    if (isDomainError(e)) return json({ error: e.code, messageKey: e.messageKey, params: e.params }, httpStatusFor(e.code));
    console.error('[account/wallet]', e);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
  }
}

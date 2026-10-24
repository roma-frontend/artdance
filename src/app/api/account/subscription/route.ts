/**
 * API: GET /api/account/subscription — активная подписка клиента и квота текущего месяца.
 *
 * Личность только из серверной сессии. Тумблер `subscriptions` проверяется так же,
 * как на странице: выключенный модуль отвечает `FEATURE_DISABLED`.
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
    await assertEntitlementOrThrow('subscriptions');
    const caller = await getCaller();
    if (!caller) throw domainErrors.unauthorized();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const subscription = await db.subscription.findFirst({
      where: { userId: caller.id, status: { in: ['ACTIVE', 'TRIALING'] } },
      orderBy: { currentPeriodEnd: 'desc' },
      select: {
        id: true,
        planId: true,
        interval: true,
        status: true,
        priceSnapshot: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        usage: {
          where: { periodStart: { gte: monthStart } },
          select: { metric: true, used: true },
        },
      },
    });

    if (!subscription) return json({ subscription: null }, 200);

    return json(
      {
        subscription: {
          id: subscription.id,
          planId: subscription.planId,
          interval: subscription.interval,
          status: subscription.status,
          price: subscription.priceSnapshot,
          currentPeriodStart: subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          usage: subscription.usage.map((u) => ({ metric: u.metric, used: u.used })),
        },
      },
      200,
    );
  } catch (e) {
    if (isDomainError(e)) return json({ error: e.code, messageKey: e.messageKey, params: e.params }, httpStatusFor(e.code));
    console.error('[account/subscription]', e);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
  }
}

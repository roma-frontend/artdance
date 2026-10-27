/**
 * DEV-ONLY: тестовое подтверждение PaymentIntent для Expo Go.
 *
 * В Expo Go нативная форма Stripe недоступна, поэтому приложение показывает заглушку
 * ввода карты и просит сервер подтвердить PaymentIntent тестовым методом Stripe
 * (`pm_card_visa` или `pm_card_chargeDeclined`). Номер карты на сервер не уходит:
 * сценарий выбирается на клиенте.
 *
 * Маршрут закрыт в трёх местах: не в production, только ключ `sk_test_`, только владелец платежа.
 * Реальные деньги с его помощью списать нельзя.
 */

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';

import { getServerEnv } from '@/config/env';
import { absoluteUrl } from '@/config/site';
import { isSupportOperator } from '@/config/security';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  providerTransactionId: z.string().regex(/^pi_[A-Za-z0-9]+$/).max(128),
  scenario: z.enum(['success', 'declined']),
});

const noStore = { 'Cache-Control': 'no-store' };

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: noStore });
}

export async function POST(request: Request) {
  const env = getServerEnv();
  const key = env.STRIPE_SECRET_KEY;
  if (env.NODE_ENV === 'production' || !key?.startsWith('sk_test_')) {
    return json({ error: 'NOT_FOUND' }, 404);
  }

  const caller = await getCaller();
  if (!caller) return json({ error: 'UNAUTHORIZED' }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED' }, 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED' }, 400);

  const payment = await db.payment.findFirst({
    where: { providerTransactionId: parsed.data.providerTransactionId },
    select: { orderId: true, bookingId: true },
  });
  if (!payment) return json({ error: 'NOT_FOUND' }, 404);

  const ownerId = payment.orderId
    ? (await db.order.findUnique({ where: { id: payment.orderId }, select: { userId: true } }))?.userId ?? null
    : payment.bookingId
      ? (await db.booking.findUnique({ where: { id: payment.bookingId }, select: { customerId: true } }))?.customerId ?? null
      : null;
  if (!(ownerId === caller.id || isSupportOperator(caller))) return json({ error: 'FORBIDDEN' }, 403);

  const stripe = new Stripe(key, { apiVersion: '2024-12-18.acl' as never });
  const paymentMethod = parsed.data.scenario === 'success' ? 'pm_card_visa' : 'pm_card_chargeDeclined';

  try {
    const intent = await stripe.paymentIntents.confirm(parsed.data.providerTransactionId, {
      payment_method: paymentMethod,
      return_url: absoluteUrl('/api/payments/return'),
    });
    return json({ status: intent.status }, 200);
  } catch (error) {
    // Отказ тестовой карты ожидаем: это и есть проверяемый сценарий, а не сбой.
    const type = (error as { type?: string }).type;
    if (parsed.data.scenario === 'declined' && type === 'StripeCardError') {
      return json({ status: 'declined', code: (error as { code?: string }).code ?? null }, 200);
    }
    console.error('[payments:dev-confirm]', error);
    return json({ error: 'STRIPE_ERROR' }, 502);
  }
}

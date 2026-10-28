/**
 * Тестовое подтверждение платежа для встроенной формы (сайт и приложение).
 *
 * Провайдер mock: сценарий задаёт исход (успех или отказ), платёж сверяется через
 * reconcile с пометкой «симулировано». Провайдер Stripe: PaymentIntent подтверждается
 * тестовым методом (`pm_card_visa` или `pm_card_chargeDeclined`). Номер карты на сервер
 * не уходит: сценарий выбирается на клиенте.
 *
 * Владелец платежа — вошедший пользователь либо гость по `anonymousId` (только у заказа
 * без владельца-пользователя). Поддержка проходит всегда. Mock не списывает реальных денег
 * и работает в любом окружении: на демо-стенде иначе нельзя завершить ни одну покупку.
 * Stripe — только с ключом `sk_test_` и не в production.
 */

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';

import { getServerEnv } from '@/config/env';
import { absoluteUrl } from '@/config/site';
import { isSupportOperator } from '@/config/security';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { reconcilePayment } from '@/server/payments/reconcile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  providerTransactionId: z.string().regex(/^(pi|mock)_[A-Za-z0-9-]+$/).max(128),
  scenario: z.enum(['success', 'declined']),
  /** Гостевой ключ браузера: доказывает владение гостевым заказом. С сессией не нужен. */
  anonymousId: z.string().min(8).max(128).optional(),
});

/** Владелец платежа: пользователь, либо гостевой ключ заказа. У брони гостей нет. */
interface PaymentOwner {
  userId: string | null;
  anonymousId: string | null;
}

async function ownerOf(payment: { orderId: string | null; bookingId: string | null }): Promise<PaymentOwner | null> {
  if (payment.orderId) {
    const order = await db.order.findUnique({
      where: { id: payment.orderId },
      select: { userId: true, anonymousId: true },
    });
    return order ? { userId: order.userId, anonymousId: order.anonymousId } : null;
  }
  if (payment.bookingId) {
    const booking = await db.booking.findUnique({
      where: { id: payment.bookingId },
      select: { customerId: true },
    });
    return booking ? { userId: booking.customerId, anonymousId: null } : null;
  }
  return null;
}

const noStore = { 'Cache-Control': 'no-store' };

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: noStore });
}

export async function POST(request: Request) {
  const env = getServerEnv();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED' }, 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED' }, 400);
  const { anonymousId } = parsed.data;

  // Без входа и без гостевого ключа владельца не установить: отказ раньше любого запроса к базе.
  const caller = await getCaller();
  if (!caller && !anonymousId) return json({ error: 'UNAUTHORIZED' }, 401);

  const payment = await db.payment.findFirst({
    where: { providerTransactionId: parsed.data.providerTransactionId },
    select: { id: true, provider: true, orderId: true, bookingId: true },
  });
  if (!payment) return json({ error: 'NOT_FOUND' }, 404);

  const owner = await ownerOf(payment);
  const ownsByAccount = caller !== null && owner?.userId != null && owner.userId === caller.id;
  const ownsAsGuest =
    owner !== null && owner.userId === null && owner.anonymousId !== null && anonymousId === owner.anonymousId;
  const isOperator = caller !== null && isSupportOperator(caller);
  if (!(ownsByAccount || ownsAsGuest || isOperator)) return json({ error: 'FORBIDDEN' }, 403);

  if (payment.provider === 'mock') {
    const result = await reconcilePayment({
      paymentId: payment.id,
      simulatedOutcome: parsed.data.scenario === 'success' ? 'PAID' : 'FAILED',
    });
    return json({ status: result.status === 'FAILED' ? 'declined' : result.status }, 200);
  }

  const key = env.STRIPE_SECRET_KEY;
  if (
    env.NODE_ENV === 'production' ||
    !key?.startsWith('sk_test_') ||
    !parsed.data.providerTransactionId.startsWith('pi_')
  ) {
    return json({ error: 'NOT_FOUND' }, 404);
  }

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

/**
 * API: GET /api/account/orders — заказы текущего клиента для мобильного приложения.
 *
 * Личность берётся только из серверной сессии (bearer или cookie). Возвращаются
 * только заказы, где владелец — текущий пользователь. Гостевые заказы сюда не входят.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { createOrder } from '@/server/orders/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMIT = 50;

export async function GET() {
  const caller = await getCaller();
  if (!caller) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' },
      { status: 401, headers: { 'Cache-Control': cacheControl.none } },
    );
  }

  const rows = await db.order.findMany({
    where: { userId: caller.id },
    orderBy: { placedAt: 'desc' },
    take: LIMIT,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      currencyCode: true,
      placedAt: true,
      items: { select: { titleSnapshot: true, quantity: true } },
    },
  });

  const orders = rows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    total: o.total,
    currencyCode: o.currencyCode,
    placedAt: o.placedAt.toISOString(),
    items: o.items.map((i) => ({ title: i.titleSnapshot, quantity: i.quantity })),
  }));

  return NextResponse.json({ orders }, { headers: { 'Cache-Control': cacheControl.none } });
}

const createSchema = z.object({
  contactName: z.string().trim().min(1).max(80),
  contactEmail: z.string().trim().email().max(254),
  contactPhone: z.string().min(6).max(30),
  deliveryMethod: z.enum(['COURIER', 'PICKUP_POINT']).nullable(),
  deliveryAddress: z
    .object({
      street: z.string().trim().min(1).max(200),
      city: z.string().trim().min(1).max(120),
      postalCode: z.string().trim().max(20).nullable().optional(),
    })
    .nullable()
    .optional(),
  deliveryNotes: z.string().max(500).nullable().optional(),
});

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

/**
 * Создание заказа из корзины залогиненного клиента. Логика та же, что у веба
 * (`createOrderAction`): магазин включён, позиции и цены пересчитываются в
 * `createOrder`, адрес нужен только курьеру. Гостям заказ здесь не создаётся.
 */
export async function POST(request: Request) {
  const caller = await getCaller();
  if (!caller) {
    return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  }

  const limit = await checkRateLimit('paymentIntent', clientIdentifier(request.headers));
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'paymentIntent'),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  const input = parsed.data;

  try {
    await assertEntitlementOrThrow('shop');
    const order = await createOrder({
      userId: caller.id,
      anonymousId: null,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      deliveryMethod: input.deliveryMethod,
      deliveryAddress: input.deliveryMethod === 'COURIER' ? (input.deliveryAddress ?? null) : null,
      deliveryNotes: input.deliveryNotes ?? null,
    });
    return json({ order: { id: order.id, orderNumber: order.orderNumber, total: order.total } }, 201);
  } catch (error) {
    if (isDomainError(error)) {
      return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
    }
    console.error('[account:orders:create]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

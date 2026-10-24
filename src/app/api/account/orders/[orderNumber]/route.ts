/**
 * API: GET /api/account/orders/[orderNumber] — заказ текущего клиента для мобильного приложения.
 *
 * Чужой и несуществующий заказ отдаются одинаково (404), чтобы не раскрывать номера.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const caller = await getCaller();
  if (!caller) {
    return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  }

  const { orderNumber } = await params;
  const order = await db.order.findUnique({
    where: { orderNumber },
    select: {
      orderNumber: true,
      status: true,
      placedAt: true,
      currencyCode: true,
      subtotal: true,
      discountTotal: true,
      deliveryFee: true,
      total: true,
      userId: true,
      items: { select: { titleSnapshot: true, quantity: true, lineTotal: true } },
      payments: { select: { status: true, amount: true }, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!order || order.userId !== caller.id) {
    return json({ error: 'NOT_FOUND' }, 404);
  }

  return json(
    {
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        placedAt: order.placedAt.toISOString(),
        currencyCode: order.currencyCode,
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        items: order.items.map((i) => ({ title: i.titleSnapshot, quantity: i.quantity, lineTotal: i.lineTotal })),
        payments: order.payments.map((p) => ({ status: p.status, amount: p.amount })),
      },
    },
    200,
  );
}

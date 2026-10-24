/**
 * API: GET /api/account/orders — заказы текущего клиента для мобильного приложения.
 *
 * Личность берётся только из серверной сессии (bearer или cookie). Возвращаются
 * только заказы, где владелец — текущий пользователь. Гостевые заказы сюда не входят.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';

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

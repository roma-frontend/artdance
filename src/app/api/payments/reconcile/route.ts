import { NextResponse } from 'next/server';

import { getCaller } from '@/lib/auth/guards';
import { reconcilePayment } from '@/server/payments/reconcile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400, headers: { 'Cache-Control': 'no-store' } }); }
  const id = (body as { paymentId?: string })?.paymentId;
  if (!id || typeof id !== 'string' || id.length > 128) return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

  const { db } = await import('@/lib/db');
  const { isSupportOperator } = await import('@/config/security');
  // Ownership guard: reconcile может только владелец платежа/брони/заказа или support/admin
  const payment = (await db.payment.findFirst({
    where: { OR: [{ id }, { providerTransactionId: id }] },
    select: { id: true, orderId: true, bookingId: true },
  } as never) as { id: string; orderId: string | null; bookingId: string | null } | null);
  if (payment) {
    let ownerId: string | null = null;
    if (payment.orderId) {
      const o = await db.order.findUnique({ where: { id: payment.orderId }, select: { userId: true } });
      ownerId = (o as unknown as { userId: string | null } | null)?.userId ?? null;
    } else if (payment.bookingId) {
      const b = await db.booking.findUnique({ where: { id: payment.bookingId }, select: { customerId: true } });
      ownerId = (b as unknown as { customerId: string | null } | null)?.customerId ?? null;
    }
    const isOwner = ownerId !== null && ownerId === caller.id;
    const isPriv = isSupportOperator(caller) || caller.role === 'ADMIN';
    if (!isOwner && !isPriv) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const result = await reconcilePayment({ paymentId: id });
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

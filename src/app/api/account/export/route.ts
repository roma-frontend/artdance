/**
 * API: GET /api/account/export — JSON дамп данных пользователя (A-10).
 */

import { db } from '@/lib/db';
import { getCaller } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const caller = await getCaller();
  if (!caller) return new Response('Unauthorized', { status: 401 });
  const [user, bookings, orders] = await Promise.all([
    db.user.findUnique({ where: { id: caller.id }, select: { id: true, email: true, name: true, locale: true, createdAt: true } }),
    db.booking.findMany({ where: { customerId: caller.id }, select: { id: true, reference: true, status: true, startsAt: true, endsAt: true, totalPrice: true } }),
    db.order.findMany({ where: { userId: caller.id }, select: { id: true, orderNumber: true, status: true, total: true, placedAt: true } }),
  ]);
  const payload = { user, bookings, orders, exportedAt: new Date().toISOString() };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename=\"artdance-export.json\"', 'Cache-Control': 'no-store' },
  });
}

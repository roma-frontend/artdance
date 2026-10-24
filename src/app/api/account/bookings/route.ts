/**
 * API: GET /api/account/bookings — брони текущего клиента для мобильного приложения.
 *
 * Личность берётся только из серверной сессии (bearer или cookie). Возвращаются
 * только брони, где клиент — текущий пользователь. Цены зафиксированы в момент брони.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMIT = 50;
const RESCHEDULABLE_STATUSES: ReadonlySet<string> = new Set(['PENDING', 'CONFIRMED']);

export async function GET() {
  const caller = await getCaller();
  if (!caller) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' },
      { status: 401, headers: { 'Cache-Control': cacheControl.none } },
    );
  }

  const rows = await db.booking.findMany({
    where: { customerId: caller.id },
    orderBy: { startsAt: 'desc' },
    take: LIMIT,
    select: {
      id: true,
      reference: true,
      status: true,
      startsAt: true,
      endsAt: true,
      totalPrice: true,
      currencyCode: true,
      sessionId: true,
      rescheduleCount: true,
      maxReschedules: true,
      instructor: { select: { slug: true, user: { select: { name: true } } } },
      session: { select: { danceClass: { select: { title: true } } } },
    },
  });

  const bookings = rows.map((b) => ({
    id: b.id,
    reference: b.reference,
    status: b.status,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    totalPrice: b.totalPrice,
    currencyCode: b.currencyCode,
    classTitle: b.session?.danceClass?.title ?? null,
    instructorName: b.instructor?.user?.name ?? null,
    instructorSlug: b.instructor?.slug ?? null,
    canReschedule:
      !b.sessionId && !!b.instructor && RESCHEDULABLE_STATUSES.has(b.status) && b.rescheduleCount < b.maxReschedules,
  }));

  return NextResponse.json({ bookings }, { headers: { 'Cache-Control': cacheControl.none } });
}

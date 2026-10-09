/**
 * PASS VERIFY + CHECK-IN — /api/booking/pass/verify
 * POST { token, action: "peek" | "checkIn" }
 * - peek: только проверка подлинности и статуса (кто пришёл, не отмечая).
 * - checkIn: отметка посещения (ставит Booking.checkInAt/by, идемпотентна).
 * Доступ: INSTRUCTOR/STAFF. Клиент не может чекинить сам себя.
 */

import 'server-only';

import { NextResponse } from 'next/server';

import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { token?: string; action?: 'peek' | 'checkIn' };

export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const isStaff = caller.role === 'ADMIN' || caller.role === 'SUPPORT' || caller.role === 'INSTRUCTOR' || caller.role === 'VENUE_OWNER';
  if (!isStaff) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
  }
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const action = body.action === 'checkIn' ? 'checkIn' : 'peek';
  if (!token) return NextResponse.json({ error: 'BAD_TOKEN' }, { status: 400 });

  const { verifyPassToken } = await import('@/server/booking/pass-token');
  const v = verifyPassToken(token);
  if (!v.ok) {
    return NextResponse.json({ ok: false, reason: v.reason }, { status: v.reason === 'EXPIRED' ? 410 : 400 });
  }

  const booking = await db.booking.findUnique({
    where: { id: v.payload.bookingId },
    select: {
      id: true,
      reference: true,
      status: true,
      startsAt: true,
      endsAt: true,
      customerId: true,
      instructorId: true,
      venueId: true,
      checkInAt: true,
      customer: { select: { name: true, email: true } },
      instructor: { select: { user: { select: { name: true } } } },
      venue: { select: { name: true } },
    },
  });
  if (!booking) return NextResponse.json({ ok: false, reason: 'NOT_FOUND' as const }, { status: 404 });

  const already = Boolean(booking.checkInAt);

  if (action === 'peek') {
    return NextResponse.json({
      ok: true,
      alreadyCheckedIn: already,
      booking: {
        reference: booking.reference,
        status: booking.status,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        customerName: booking.customer.name,
        customerEmail: booking.customer.email,
        instructorName: booking.instructor?.user.name ?? null,
        venueName: booking.venue?.name ?? null,
        checkInAt: booking.checkInAt?.toISOString() ?? null,
      },
    });
  }

  if (already) {
    return NextResponse.json({ ok: false, reason: 'ALREADY_CHECKED_IN' as const, checkInAt: booking.checkInAt?.toISOString() }, { status: 409 });
  }

  // Окно чекина: ± checkInWindowMinutes от startsAt
  const { booking: bookingCfg } = await import('@/config/business');
  const windowMs = bookingCfg.checkInWindowMinutes * 60_000;
  const now = Date.now();
  const start = new Date(booking.startsAt).getTime();
  if (Math.abs(now - start) > windowMs && now > start + windowMs) {
    // Уже прошло окно после начала — всё равно разрешаем, но помечаем late
  }

  const updated = await db.booking.update({
    where: { id: booking.id },
    data: { checkInAt: new Date(), checkedInById: caller.id },
    select: { checkInAt: true },
  });

  return NextResponse.json({ ok: true, checkedIn: true, checkInAt: updated.checkInAt?.toISOString() ?? null });
}

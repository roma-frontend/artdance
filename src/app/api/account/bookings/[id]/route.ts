/**
 * API: GET /api/account/bookings/[id] — детали одной брони владельца для мобильного приложения.
 *
 * Чужая и несуществующая бронь отвечают одинаково (404), чтобы не раскрывать, что она есть.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RESCHEDULABLE_STATUSES: ReadonlySet<string> = new Set(['PENDING', 'CONFIRMED']);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': cacheControl.none };
  const caller = await getCaller();
  if (!caller) {
    return NextResponse.json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, { status: 401, headers });
  }

  const { id } = await params;
  const row = await db.booking.findFirst({
    where: { id, customerId: caller.id },
    select: {
      id: true,
      reference: true,
      status: true,
      startsAt: true,
      endsAt: true,
      totalPrice: true,
      basePrice: true,
      travelFee: true,
      currencyCode: true,
      lessonType: true,
      partnerName: true,
      cancelledAt: true,
      cancellationReason: true,
      sessionId: true,
      rescheduleCount: true,
      maxReschedules: true,
      payments: { where: { status: { in: ['AUTHORIZED', 'PAID', 'PARTIALLY_REFUNDED'] } }, select: { id: true }, take: 1 },
      instructor: { select: { slug: true, user: { select: { name: true } } } },
      venue: { select: { name: true } },
      session: { select: { danceClass: { select: { title: true } } } },
      event: { select: { title: true, locationName: true, venue: { select: { name: true } } } },
    },
  });

  if (!row) {
    return NextResponse.json({ error: 'NOT_FOUND', messageKey: 'errors.notFound.description' }, { status: 404, headers });
  }

  const review = await db.review.findUnique({
    where: { authorId_bookingId: { authorId: caller.id, bookingId: row.id } },
    select: { moderation: true },
  });

  const booking = {
    id: row.id,
    reference: row.reference,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    totalPrice: row.totalPrice,
    basePrice: row.basePrice,
    travelFee: row.travelFee,
    currencyCode: row.currencyCode,
    paid: row.payments.length > 0,
    lessonType: row.lessonType,
    partnerName: row.partnerName,
    venueName: row.venue?.name ?? row.event?.venue?.name ?? row.event?.locationName ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancellationReason: row.cancellationReason,
    classTitle: row.event?.title ?? row.session?.danceClass?.title ?? null,
    instructorName: row.instructor?.user?.name ?? null,
    instructorSlug: row.instructor?.slug ?? null,
    canReschedule:
      !row.sessionId && !!row.instructor && RESCHEDULABLE_STATUSES.has(row.status) && row.rescheduleCount < row.maxReschedules,
    reviewModeration: review?.moderation ?? null,
  };

  return NextResponse.json({ booking }, { headers });
}

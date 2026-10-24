/**
 * API: POST /api/account/reviews — отзыв по брони владельца для мобильного приложения.
 *
 * Правила как у `createReviewAction`: только владелец брони, статус CONFIRMED или COMPLETED,
 * для CONFIRMED занятие уже закончилось, отзыв в окне `reviews.windowDays` после endsAt.
 * Повтор по той же брони возвращает уже созданный отзыв.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { reviews } from '@/config/business';
import { getCaller } from '@/lib/auth/guards';
import { recordAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REVIEWABLE_STATUSES: ReadonlySet<string> = new Set(['CONFIRMED', 'COMPLETED']);
const WINDOW_MS = reviews.windowDays * 24 * 60 * 60 * 1_000;
const EDIT_WINDOW_MS = reviews.allowEditWithinHours * 60 * 60 * 1_000;

const createSchema = z.object({
  bookingId: z.string().min(1).max(64),
  rating: z.number().int().min(reviews.minRating).max(reviews.maxRating),
  body: z.string().trim().min(reviews.minLength).max(reviews.maxLength),
});

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

export async function POST(request: Request) {
  const caller = await getCaller();
  if (!caller) {
    return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  }

  const limit = await checkRateLimit('reviewSubmit', clientIdentifier(request.headers));
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'reviewSubmit'),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'errors.generic.description' }, 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'errors.generic.description' }, 400);
  const input = parsed.data;

  const booking = await db.booking.findFirst({
    where: { id: input.bookingId, customerId: caller.id },
    select: {
      id: true,
      status: true,
      endsAt: true,
      instructorId: true,
      venueId: true,
      session: { select: { classId: true } },
    },
  });
  if (!booking) {
    return json({ error: 'NOT_FOUND', messageKey: 'errors.notFound.description' }, 404);
  }

  const existing = await db.review.findUnique({
    where: { authorId_bookingId: { authorId: caller.id, bookingId: booking.id } },
    select: { id: true, moderation: true },
  });
  if (existing) return json({ review: existing }, 200);

  const endedAt = booking.endsAt.getTime();
  const now = Date.now();
  if (!REVIEWABLE_STATUSES.has(booking.status) || (booking.status !== 'COMPLETED' && endedAt > now)) {
    return json({ error: 'NOT_COMPLETED', messageKey: 'reviews.onlyAfterBooking' }, 409);
  }
  if (now - endedAt > WINDOW_MS) {
    return json({ error: 'WINDOW_CLOSED', messageKey: 'reviews.windowClosed' }, 409);
  }

  const review = await db.review.create({
    data: {
      authorId: caller.id,
      bookingId: booking.id,
      instructorId: booking.instructorId ?? undefined,
      venueId: booking.venueId ?? undefined,
      classId: booking.session?.classId ?? undefined,
      rating: input.rating,
      body: input.body,
      authorRole: null,
      isVerifiedPurchase: true,
      moderation: reviews.requireModeration ? 'PENDING' : 'APPROVED',
      editableUntil: new Date(now + EDIT_WINDOW_MS),
    },
    select: { id: true, moderation: true },
  });

  await recordAudit({
    actor: caller,
    action: 'public.review.create',
    entityType: 'Review',
    entityId: review.id,
    after: { bookingId: booking.id, rating: input.rating },
    ipAddress: clientIdentifier(request.headers),
  }).catch(() => {});

  return json({ review }, 201);
}

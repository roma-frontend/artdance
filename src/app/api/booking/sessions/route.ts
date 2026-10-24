/**
 * GET /api/booking/sessions — проведения группового занятия у инструктора.
 *
 * Тот же контракт, что страница бронирования с `?class=`: слоты с `sessionId`,
 * заполненность и, для вошедшего клиента, его место в листе ожидания.
 *
 * Ответ не кешируется: заполненность меняется с каждой бронью. Вход необязателен:
 * без него сервер просто не отдаёт личную часть (`waitlist`).
 */

import { NextResponse } from 'next/server';

import { booking } from '@/config/business';
import { cacheControl } from '@/config/cache';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { getInstructorBookingContent } from '@/server/content/booking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ErrorCode = 'class_required' | 'not_found' | 'rate_limited';

function jsonResponse(body: object, status: number, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl.none,
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function errorResponse(code: ErrorCode, status: number, extra: object = {}, headers = {}) {
  return jsonResponse({ error: code, ...extra }, status, headers);
}

export async function GET(request: Request): Promise<NextResponse> {
  const limit = await checkRateLimit('availability', clientIdentifier(request.headers));
  if (!limit.allowed) {
    return errorResponse('rate_limited', 429, { retryAfterSeconds: limit.retryAfterSeconds }, rateLimitHeaders(limit, 'availability'));
  }

  const url = new URL(request.url);
  const instructorSlug = (url.searchParams.get('instructor') ?? '').trim();
  const classSlug = (url.searchParams.get('class') ?? '').trim();
  if (instructorSlug.length === 0 || classSlug.length === 0) return errorResponse('class_required', 400);

  const now = new Date();
  const content = await getInstructorBookingContent(instructorSlug, now, undefined, classSlug);
  if (!content || !('days' in content)) return errorResponse('not_found', 404);

  const slots = content.days.flatMap((day) =>
    day.slots.flatMap((slot) =>
      slot.sessionId && slot.startIso && slot.endIso && slot.endTime !== undefined
        ? [{
            startIso: slot.startIso,
            startTime: slot.start,
            endTime: slot.endTime,
            endIso: slot.endIso,
            sessionId: slot.sessionId,
            available: slot.available,
            spotsLeft: slot.spotsLeft ?? 0,
          }]
        : [],
    ),
  );

  const caller = await getCaller();
  const mine = caller
    ? await db.waitlistEntry.findMany({
        where: { userId: caller.id, sessionId: { in: slots.map((slot) => slot.sessionId) } },
        select: { sessionId: true, position: true, claimUntil: true },
      })
    : [];
  const waitlistBySession = new Map(
    mine.map((entry) => [
      entry.sessionId,
      {
        position: entry.position,
        claimable: entry.claimUntil !== null && entry.claimUntil.getTime() > now.getTime(),
      },
    ]),
  );

  return jsonResponse(
    {
      instructorSlug,
      classSlug,
      lessonType: content.lessonType ?? 'GROUP',
      waitlistOpen: booking.waitlistEnabled,
      slots: slots.map((slot) => ({ ...slot, waitlist: waitlistBySession.get(slot.sessionId) ?? null })),
    },
    200,
  );
}

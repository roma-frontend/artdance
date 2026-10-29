import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCaller } from '@/lib/auth/guards';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { cacheControl } from '@/config/cache';
import { bookingConsentIds } from '@/config/consents';

import { createRecurringSeries } from '@/server/recurring/service';

const schema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int().refine((n) => [45, 60, 90, 120].includes(n)),
  weeks: z.number().int().min(2).max(12),
  instructorId: z.string().min(1),
  startsAt: z.string().datetime().optional(),
  locationOption: z.enum(['STUDIO', 'CUSTOMER_LOCATION', 'ONLINE']).optional(),
  consents: z.array(z.enum(bookingConsentIds)).max(bookingConsentIds.length).optional(),
  participantBirthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

export async function POST(request: Request) {
  const caller = await getCaller();
  if (!caller) return json({ error: 'UNAUTHORIZED' }, 401);
  const limit = await checkRateLimit('bookingHold', clientIdentifier(request.headers));
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'bookingHold'),
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED' }, 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED' }, 400);
  try {
    const ip = clientIdentifier(request.headers);
    const result = await createRecurringSeries({
      customerId: caller.id,
      instructorId: parsed.data.instructorId,
      weekday: parsed.data.weekday,
      startTime: parsed.data.startTime,
      durationMinutes: parsed.data.durationMinutes,
      weeks: parsed.data.weeks,
      locationOption: parsed.data.locationOption,
      consents: parsed.data.consents ?? [],
      participantBirthDate: parsed.data.participantBirthDate ?? null,
      ipAddress: ip === 'unknown' ? null : ip,
      firstStartsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      now: new Date(),
    });
    return json(result, 201);
  } catch (error) {
    const { isDomainError, httpStatusFor } = await import('@/domain/errors');
    if (isDomainError(error)) return json({ error: error.code, messageKey: error.messageKey, params: error.params, field: error.field }, httpStatusFor(error.code));
    throw error;
  }
}

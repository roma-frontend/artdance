import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { quoteBooking } from '@/server/booking/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  instructor: z.string().min(1).max(120),
  startsAt: z.string().datetime(),
  sessionId: z.string().min(1).max(64).optional(),
  weeks: z.coerce.number().int().min(1).max(12).optional(),
});

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, 'X-Content-Type-Options': 'nosniff', ...extra } });
}

/** GET /api/booking/quote — цена слота до брони; публичный, ничего не удерживает. */
export async function GET(request: Request) {
  const limit = await checkRateLimit('availability', clientIdentifier(request.headers));
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'availability'),
    );
  }
  const url = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  try {
    const quote = await quoteBooking({
      instructor: parsed.data.instructor,
      sessionId: parsed.data.sessionId ?? null,
      startsAt: new Date(parsed.data.startsAt),
      weeks: parsed.data.weeks,
    });
    return json({ quote }, 200);
  } catch (error) {
    if (isDomainError(error)) return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
    console.error('[booking/quote]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
  }
}

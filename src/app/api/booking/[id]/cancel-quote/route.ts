import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { requireCaller } from '@/lib/auth/guards';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { quoteCancellation } from '@/server/booking/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, 'X-Content-Type-Options': 'nosniff', ...extra } });
}

/** GET /api/booking/[id]/cancel-quote — штраф и возврат при отмене сейчас; бронь не меняется. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limit = await checkRateLimit('availability', clientIdentifier(request.headers));
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'availability'),
    );
  }
  const { id } = await params;
  if (!id) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  try {
    const caller = await requireCaller();
    const quote = await quoteCancellation({ bookingId: id, userId: caller.id, now: new Date() });
    return json({ quote }, 200);
  } catch (error) {
    if (isDomainError(error)) return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
    console.error('[booking/cancel-quote]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
  }
}

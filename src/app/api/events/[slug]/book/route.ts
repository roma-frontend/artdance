/** API: POST /api/events/[slug]/book — native booking for non-competition events. */

import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl, cacheTags } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { getCaller } from '@/lib/auth/guards';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { createEventBooking } from '@/server/events/booking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status: number, headers?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': cacheControl.none, 'X-Content-Type-Options': 'nosniff', ...headers },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const limit = await checkRateLimit('bookingHold', clientIdentifier(request.headers));
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'bookingHold'),
    );
  }

  const parsedSlug = z.string().trim().min(1).max(160).safeParse((await params).slug);
  if (!parsedSlug.success) return json({ error: 'NOT_FOUND', messageKey: 'errors.notFound.description' }, 404);

  const caller = await getCaller();
  if (!caller) return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);

  try {
    await assertEntitlementOrThrow('events');
    const booking = await createEventBooking({ userId: caller.id, eventSlug: parsedSlug.data });
    revalidateTag(cacheTags.events(), 'max');
    return json(
      {
        booking: {
          id: booking.id,
          reference: booking.reference,
          totalPrice: booking.totalPrice,
          startsAt: booking.startsAt.toISOString(),
          endsAt: booking.endsAt.toISOString(),
          status: booking.status,
          title: booking.title,
        },
      },
      201,
    );
  } catch (error) {
    if (isDomainError(error)) {
      return json({ error: error.code, messageKey: error.messageKey, params: error.params, field: error.field }, httpStatusFor(error.code));
    }
    console.error('[events/book]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
  }
}

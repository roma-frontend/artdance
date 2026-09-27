import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { getCaller } from '@/lib/auth/guards';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { createBookingFromHold } from '@/server/booking/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const schema = z.object({ holdId: z.string().min(1), locationOption: z.enum(['STUDIO','CUSTOMER_LOCATION','ONLINE']).optional(), customerAddress: z.string().max(240).optional().nullable(), anonymousId: z.string().min(1).optional().nullable() });
function json(body: object, status: number, extra: Record<string,string> = {}) { return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, 'X-Content-Type-Options':'nosniff', ...extra } }); }
export async function POST(request: Request) {
  const limit = await checkRateLimit('bookingHold', clientIdentifier(request.headers));
  if (!limit.allowed) return json({ error:'RATE_LIMITED', messageKey:'errors.rateLimited.description', params:{ seconds: limit.retryAfterSeconds } }, 429, rateLimitHeaders(limit,'bookingHold'));
  let body: unknown; try { body = await request.json(); } catch { return json({ error:'VALIDATION_FAILED', messageKey:'validation.required' }, 400); }
  const parsed = schema.safeParse(body); if (!parsed.success) return json({ error:'VALIDATION_FAILED', messageKey:'validation.required' }, 400);
  const caller = await getCaller();
  const userId = caller?.id ?? null;
  const anonymousId = parsed.data.anonymousId ?? null;
  if (!userId && !anonymousId) return json({ error:'UNAUTHORIZED', messageKey:'errors.unauthorized.description' }, 401);
  try {
    const result = await createBookingFromHold({ holdId: parsed.data.holdId, userId, anonymousId, locationOption: parsed.data.locationOption, customerAddress: parsed.data.customerAddress ?? null, now: new Date() });
    return json({ booking: { id: result.id, reference: result.reference, totalPrice: result.totalPrice, startsAt: result.startsAt.toISOString(), endsAt: result.endsAt.toISOString() } }, 201);
  } catch (e) {
    if (isDomainError(e)) return json({ error: e.code, messageKey: e.messageKey, params: e.params, field: e.field }, httpStatusFor(e.code));
    console.error('[booking]', e); return json({ error:'INTERNAL', messageKey:'errors.generic.description' }, 500);
  }
}

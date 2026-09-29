import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { requireCaller } from '@/lib/auth/guards';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { cancelBooking } from '@/server/booking/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const schema = z.object({ reason: z.string().max(500).optional().nullable(), creditInsteadOfRefund: z.boolean().optional() });
function json(body: object, status: number, extra: Record<string,string> = {}) { return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, 'X-Content-Type-Options':'nosniff', ...extra } }); }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limit = await checkRateLimit('bookingHold', clientIdentifier(request.headers));
  if (!limit.allowed) return json({ error:'RATE_LIMITED', messageKey:'errors.rateLimited.description', params:{ seconds: limit.retryAfterSeconds } }, 429, rateLimitHeaders(limit,'bookingHold'));
  let body: unknown = {}; try { const t = await request.text(); if (t) body = JSON.parse(t); } catch {}
  const parsed = schema.safeParse(body ?? {});
  const { id } = await params;
  if (!id) return json({ error:'VALIDATION_FAILED', messageKey:'validation.required' }, 400);
  const caller = await requireCaller();
  try {
    const result = await cancelBooking({ bookingId: id, userId: caller.id, now: new Date(), reason: parsed.success ? (parsed.data.reason ?? null) : null, creditInsteadOfRefund: parsed.success ? Boolean(parsed.data.creditInsteadOfRefund) : false });
    return json({ booking: result.booking, fee: result.fee, refund: result.refund, outcome: result.outcome, credited: result.credited }, 200);
  } catch (e) {
    if (isDomainError(e)) return json({ error: e.code, messageKey: e.messageKey, params: e.params, field: e.field }, httpStatusFor(e.code));
    console.error('[booking/cancel]', e); return json({ error:'INTERNAL', messageKey:'errors.generic.description' }, 500);
  }
}

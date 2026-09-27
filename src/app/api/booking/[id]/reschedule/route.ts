import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { requireCaller } from '@/lib/auth/guards';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { rescheduleBooking } from '@/server/booking/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const schema = z.object({ newStartsAt: z.string().min(1), newEndsAt: z.string().min(1), newPrice: z.number().int().nonnegative().optional().nullable() });
function json(body: object, status: number, extra: Record<string,string> = {}) { return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, 'X-Content-Type-Options':'nosniff', ...extra } }); }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limit = await checkRateLimit('bookingHold', clientIdentifier(request.headers));
  if (!limit.allowed) return json({ error:'RATE_LIMITED', messageKey:'errors.rateLimited.description', params:{ seconds: limit.retryAfterSeconds } }, 429, rateLimitHeaders(limit,'bookingHold'));
  let body: unknown; try { body = await request.json(); } catch { return json({ error:'VALIDATION_FAILED', messageKey:'validation.required' }, 400); }
  const parsed = schema.safeParse(body); if (!parsed.success) return json({ error:'VALIDATION_FAILED', messageKey:'validation.required' }, 400);
  const startsAt = new Date(parsed.data.newStartsAt); const endsAt = new Date(parsed.data.newEndsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return json({ error:'VALIDATION_FAILED', messageKey:'validation.required', field:'startsAt' }, 400);
  const { id } = await params; if (!id) return json({ error:'VALIDATION_FAILED', messageKey:'validation.required' }, 400);
  const caller = await requireCaller();
  try { const r = await rescheduleBooking({ bookingId:id, userId: caller.id, now: new Date(), newStartsAt: startsAt, newEndsAt: endsAt, newPrice: parsed.data.newPrice ?? null }); return json({ booking: r.booking, priceDifference: r.priceDifference, remaining: r.remaining, durationMinutes: r.durationMinutes }, 200); }
  catch(e){ if (isDomainError(e)) return json({ error:e.code, messageKey:e.messageKey, params:e.params, field:e.field }, httpStatusFor(e.code)); console.error('[booking/reschedule]', e); return json({ error:'INTERNAL', messageKey:'errors.generic.description' }, 500); }
}

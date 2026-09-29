import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCaller } from '@/lib/auth/guards';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { cacheControl } from '@/config/cache';

import { createRecurringSeries } from '@/server/recurring/service';

const schema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int().refine((n) => [45, 60, 90, 120].includes(n)),
  weeks: z.number().int().min(2).max(12),
  instructorId: z.string().min(1),
  locationOption: z.enum(['STUDIO', 'CUSTOMER_LOCATION', 'ONLINE']).optional(),
});

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

export async function POST(request: Request) {
  const caller = await getCaller();
  if (!caller) return json({ error: 'UNAUTHORIZED' }, 401);
  const limit = await checkRateLimit('bookingHold', clientIdentifier(request.headers));
  if (!limit.allowed) return json({ error: 'RATE_LIMITED' }, 429, rateLimitHeaders(limit, 'bookingHold'));
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED' }, 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED' }, 400);
  const result = await createRecurringSeries({
    customerId: caller.id,
    instructorId: parsed.data.instructorId,
    weekday: parsed.data.weekday,
    startTime: parsed.data.startTime,
    durationMinutes: parsed.data.durationMinutes,
    weeks: parsed.data.weeks,
    locationOption: parsed.data.locationOption,
    now: new Date(),
  });
  return json(result, 201);
}

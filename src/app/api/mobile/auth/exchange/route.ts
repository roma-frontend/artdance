import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { consumeHandoffCode } from '@/server/auth/mobile-handoff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  code: z.string().min(20).max(100),
  verifier: z.string().min(43).max(128),
});

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

/** POST /api/mobile/auth/exchange — одноразовый код и verifier меняются на bearer-токен сессии. */
export async function POST(request: Request) {
  const limit = await checkRateLimit('signIn', clientIdentifier(request.headers));
  if (!limit.allowed) return json({ error: 'RATE_LIMITED' }, 429, rateLimitHeaders(limit, 'signIn'));

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED' }, 400);

  const token = await consumeHandoffCode({ code: parsed.data.code, verifier: parsed.data.verifier, now: new Date() });
  if (!token) return json({ error: 'INVALID_CODE' }, 400);
  return json({ token }, 200);
}

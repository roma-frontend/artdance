/**
 * API: POST /api/newsletter/unsubscribe — отписка по токену из письма, без входа (мобильное приложение).
 *
 * Зеркало страницы `/newsletter/unsubscribe/[token]`: та же функция, тот же результат.
 * Повторная отписка — успех; неизвестный токен — 404.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { unsubscribeFromNewsletter } from '@/server/actions/newsletter';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ token: z.string().min(16).max(128) });

function json(body: object, status: number, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...headers } });
}

export async function POST(request: Request) {
  const identifier = clientIdentifier(request.headers);
  const limit = await checkRateLimit('newsletterToken', identifier);
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'newsletterToken'),
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

  const ok = await unsubscribeFromNewsletter(parsed.data.token);
  return ok ? json({ ok: true }, 200) : json({ error: 'NOT_FOUND' }, 404);
}

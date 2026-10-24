/**
 * API: GET и PUT /api/account/dancer-profile — анкета танцора для мобильного приложения.
 *
 * GET возвращает `{ profile }`, где `profile` — `null`, если анкеты ещё нет.
 * PUT принимает шаг тура `{ level, styles, goal, note, completed }` и возвращает
 * сохранённый `{ profile }`.
 *
 * Личность берётся только из серверной сессии (bearer или cookie).
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { dancerOnboardingSchema } from '@/domain/dancer-profile';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { getCaller } from '@/lib/auth/guards';
import { checkRateLimit, rateLimitHeaders } from '@/lib/security/rate-limit';
import { getDancerProfile, saveDancerProfile } from '@/server/dancer-profile/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

export async function GET() {
  const caller = await getCaller();
  if (!caller) {
    return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  }

  try {
    const profile = await getDancerProfile(caller.id);
    return json({ profile }, 200);
  } catch (error) {
    console.error('[account:dancer-profile]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

export async function PUT(request: Request) {
  const caller = await getCaller();
  if (!caller) {
    return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  }

  const limit = await checkRateLimit('dancerProfile', caller.id);
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'dancerProfile'),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const parsed = dancerOnboardingSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

  try {
    await saveDancerProfile(caller.id, parsed.data);
    const profile = await getDancerProfile(caller.id);
    return json({ profile }, 200);
  } catch (error) {
    if (isDomainError(error)) {
      return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
    }
    console.error('[account:dancer-profile]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

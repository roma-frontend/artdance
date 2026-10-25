/**
 * API: GET и PATCH /api/account/profile — настройки профиля для мобильного приложения.
 *
 * GET возвращает `{ profile }`: имя, email, язык, часовой пояс и `avatarUrl`.
 * PATCH принимает `{ locale?, timeZone? }` и возвращает обновлённый `{ profile }`.
 *
 * Личность берётся только из серверной сессии (bearer или cookie).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { locales } from '@/i18n/config';
import { getCaller } from '@/lib/auth/guards';
import { checkRateLimit, rateLimitHeaders } from '@/lib/security/rate-limit';
import { getAccountProfile, updateAccountPreferences } from '@/server/account/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Проверка IANA-зоны через сам `Intl`: невалидное имя бросает `RangeError`. */
function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const preferencesSchema = z
  .object({
    locale: z.enum(locales).optional(),
    timeZone: z.string().min(1).max(64).refine(isTimeZone, 'INVALID_TIME_ZONE').optional(),
  })
  .refine((value) => value.locale !== undefined || value.timeZone !== undefined, 'EMPTY');

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

export async function GET() {
  const caller = await getCaller();
  if (!caller) {
    return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  }

  try {
    const profile = await getAccountProfile(caller.id);
    if (!profile) return json({ error: 'NOT_FOUND', messageKey: 'errors.generic.title' }, 404);
    return json({ profile }, 200);
  } catch (error) {
    console.error('[account:profile]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

export async function PATCH(request: Request) {
  const caller = await getCaller();
  if (!caller) {
    return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  }

  const limit = await checkRateLimit('accountPreferences', caller.id);
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'accountPreferences'),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

  try {
    const profile = await updateAccountPreferences(caller.id, parsed.data);
    if (!profile) return json({ error: 'NOT_FOUND', messageKey: 'errors.generic.title' }, 404);
    return json({ profile }, 200);
  } catch (error) {
    if (isDomainError(error)) {
      return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
    }
    console.error('[account:profile]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

/**
 * API: GET и PUT /api/account/notifications — уведомления кабинета для мобильного приложения.
 *
 * GET возвращает `{ preferences, items }`: переключатели email по типам и историю писем.
 * PUT принимает `{ type, email }` и возвращает обновлённые `{ preferences }`.
 *
 * Личность берётся только из серверной сессии (bearer или cookie).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { notificationTypes } from '@/config/notifications';
import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { getCaller } from '@/lib/auth/guards';
import { checkRateLimit, rateLimitHeaders } from '@/lib/security/rate-limit';
import {
  getEmailPreferences,
  listNotificationHistory,
  setEmailPreference,
} from '@/server/notifications/preferences';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const preferenceSchema = z.object({
  type: z.enum(notificationTypes),
  email: z.boolean(),
});

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

export async function GET() {
  const caller = await getCaller();
  if (!caller) {
    return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  }

  try {
    const [preferences, items] = await Promise.all([
      getEmailPreferences(caller.id),
      listNotificationHistory(caller.id),
    ]);
    return json({ preferences, items }, 200);
  } catch (error) {
    console.error('[account:notifications]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

export async function PUT(request: Request) {
  const caller = await getCaller();
  if (!caller) {
    return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  }

  const limit = await checkRateLimit('notificationPrefs', caller.id);
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'notificationPrefs'),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const parsed = preferenceSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

  try {
    await setEmailPreference(caller.id, parsed.data.type, parsed.data.email);
    const preferences = await getEmailPreferences(caller.id);
    return json({ preferences }, 200);
  } catch (error) {
    if (isDomainError(error)) {
      return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
    }
    console.error('[account:notifications]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

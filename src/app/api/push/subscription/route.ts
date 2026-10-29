/**
 * API: POST и DELETE /api/push/subscription — Web Push-подписка текущего устройства (C-07).
 *
 * POST принимает `{ endpoint, keys: { p256dh, auth } }` из `PushSubscription.toJSON()`.
 * Повторная регистрация того же endpoint тем же пользователем обновляет ключи.
 * Endpoint, уже привязанный к другому аккаунту, не переносится: ответ 409.
 * DELETE принимает `{ endpoint }` и удаляет только строку текущего пользователя.
 *
 * Личность берётся только из серверной сессии (bearer или cookie).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { isAllowedPushEndpoint } from '@/config/notifications';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const endpointSchema = z
  .url()
  .max(2048)
  .refine(isAllowedPushEndpoint, { message: 'endpoint не из списка push-сервисов' });

const subscriptionSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
});

const unsubscribeSchema = z.object({ endpoint: endpointSchema });

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

/** Prisma P2002: endpoint уже существует (гонка двух одновременных регистраций). */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';
}

export async function POST(request: Request) {
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

  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

  const { endpoint, keys } = parsed.data;
  try {
    const existing = await db.pushSubscription.findUnique({ where: { endpoint }, select: { userId: true } });
    if (existing && existing.userId !== caller.id) {
      return json({ error: 'CONFLICT', messageKey: 'errors.generic.description' }, 409);
    }
    if (existing) {
      await db.pushSubscription.updateMany({
        where: { endpoint, userId: caller.id },
        data: { p256dh: keys.p256dh, auth: keys.auth },
      });
    } else {
      await db.pushSubscription.create({
        data: { userId: caller.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      });
    }
    return json({ ok: true }, 200);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return json({ error: 'CONFLICT', messageKey: 'errors.generic.description' }, 409);
    }
    console.error('[push:subscription]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

export async function DELETE(request: Request) {
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

  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

  try {
    // Только строка текущего пользователя: чужой endpoint не трогаем, даже если он известен.
    await db.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, userId: caller.id } });
    return json({ ok: true }, 200);
  } catch (error) {
    console.error('[push:subscription]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

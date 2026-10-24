/**
 * API: GET и POST /api/account/favorites — избранное текущего клиента для мобильного приложения.
 * POST переключает запись (`{ target, slug }`) и возвращает `{ isFavorite }`.
 *
 * Личность берётся только из серверной сессии (bearer или cookie). Выборка та же,
 * что у страницы кабинета (`getFavorites`), поэтому скрытое из каталога сюда не попадает.
 * Четыре группы сводятся в один плоский список с видом записи.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { getCaller } from '@/lib/auth/guards';
import { checkRateLimit, rateLimitHeaders } from '@/lib/security/rate-limit';
import { toggleFavorite, type FavoriteTarget } from '@/server/favorites/service';
import { getFavorites } from '@/server/queries/favorites';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const toggleSchema = z.object({
  target: z.enum(['class', 'instructor', 'venue', 'product']),
  slug: z.string().min(1).max(200),
});

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

export async function GET() {
  const caller = await getCaller();
  if (!caller) {
    return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  }

  const favorites = await getFavorites(caller.id);

  const items = [
    ...favorites.classes.map((i) => ({ kind: 'class' as const, slug: i.slug, title: i.title })),
    ...favorites.instructors.map((i) => ({ kind: 'instructor' as const, slug: i.slug, title: i.name })),
    ...favorites.venues.map((i) => ({ kind: 'venue' as const, slug: i.slug, title: i.name })),
    ...favorites.products.map((i) => ({ kind: 'product' as const, slug: i.slug, title: i.title })),
  ];

  return json({ items }, 200);
}

export async function POST(request: Request) {
  const caller = await getCaller();
  if (!caller) {
    return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  }

  const limit = await checkRateLimit('search', caller.id);
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'search'),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

  try {
    const result = await toggleFavorite({
      userId: caller.id,
      target: parsed.data.target as FavoriteTarget,
      slug: parsed.data.slug,
    });
    return json(result, 200);
  } catch (error) {
    if (isDomainError(error)) {
      return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
    }
    console.error('[account:favorites]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

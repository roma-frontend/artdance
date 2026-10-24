/**
 * API: GET /api/account/favorites — избранное текущего клиента для мобильного приложения.
 *
 * Личность берётся только из серверной сессии (bearer или cookie). Выборка та же,
 * что у страницы кабинета (`getFavorites`), поэтому скрытое из каталога сюда не попадает.
 * Четыре группы сводятся в один плоский список с видом записи.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { getCaller } from '@/lib/auth/guards';
import { getFavorites } from '@/server/queries/favorites';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const caller = await getCaller();
  if (!caller) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' },
      { status: 401, headers: { 'Cache-Control': cacheControl.none } },
    );
  }

  const favorites = await getFavorites(caller.id);

  const items = [
    ...favorites.classes.map((i) => ({ kind: 'class' as const, slug: i.slug, title: i.title })),
    ...favorites.instructors.map((i) => ({ kind: 'instructor' as const, slug: i.slug, title: i.name })),
    ...favorites.venues.map((i) => ({ kind: 'venue' as const, slug: i.slug, title: i.name })),
    ...favorites.products.map((i) => ({ kind: 'product' as const, slug: i.slug, title: i.title })),
  ];

  return NextResponse.json({ items }, { headers: { 'Cache-Control': cacheControl.none } });
}

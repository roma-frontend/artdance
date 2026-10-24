/**
 * GET /api/content/cities — города и районы для мобильного приложения.
 *
 * Тот же `getCityList`, что у страниц `/cities`. Город и район мобильный экран
 * находит в этом списке, поэтому отдельных маршрутов по слагу нет.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { getCityList } from '@/server/content/geo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': cacheControl.none,
  'X-Content-Type-Options': 'nosniff',
};

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ cities: await getCityList() }, { headers });
}

/**
 * GET /api/content/styles — перечень направлений для мобильного приложения.
 *
 * Тот же список, что на `/styles`: порядок `danceStyles`, кадр и счётчики из
 * `getStyleSummaries`. Ответ не зависит от локали: названия направлений и
 * редакционные тексты приложение берёт из своих переводов по ключу `style`.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { getStyleSummaries } from '@/server/content/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const styles = await getStyleSummaries();

  return NextResponse.json(
    { styles },
    {
      headers: {
        'Cache-Control': cacheControl.none,
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}

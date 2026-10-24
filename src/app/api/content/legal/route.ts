/**
 * GET /api/content/legal?locale= — список правовых документов для мобильного приложения.
 *
 * Тот же состав, что на `/legal/*`: собирается `buildLegalIndex`.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { defaultLocale, isLocale } from '@/i18n/config';
import { buildLegalIndex } from '@/server/content/legal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const rawLocale = new URL(request.url).searchParams.get('locale') ?? '';
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const content = await buildLegalIndex(locale);

  return NextResponse.json(content, {
    headers: {
      'Cache-Control': cacheControl.none,
      'X-Content-Type-Options': 'nosniff',
      'Content-Language': locale,
    },
  });
}

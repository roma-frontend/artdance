/**
 * GET /api/content/help?locale= — справка для мобильного приложения.
 *
 * Тот же состав, что на `/help`: собирается `buildHelpContent`. Неизвестная локаль
 * подменяется основной; язык ответа объявлен в `Content-Language`.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { defaultLocale, isLocale } from '@/i18n/config';
import { buildHelpContent } from '@/server/content/help';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const rawLocale = new URL(request.url).searchParams.get('locale') ?? '';
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const content = await buildHelpContent(locale);

  return NextResponse.json(content, {
    headers: {
      'Cache-Control': cacheControl.none,
      'X-Content-Type-Options': 'nosniff',
      'Content-Language': locale,
    },
  });
}

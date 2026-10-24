/**
 * GET /api/content/faq?locale= — группы FAQ для мобильного приложения.
 *
 * Тот же список, что на `/faq`: собирается `buildFaqGroups`. Неизвестная локаль
 * подменяется основной, как в `/api/search`; язык ответа объявлен в `Content-Language`.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { defaultLocale, isLocale } from '@/i18n/config';
import { buildFaqGroups } from '@/server/content/faq';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const rawLocale = new URL(request.url).searchParams.get('locale') ?? '';
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const groups = await buildFaqGroups(locale);

  return NextResponse.json(
    { groups },
    {
      headers: {
        'Cache-Control': cacheControl.none,
        'X-Content-Type-Options': 'nosniff',
        'Content-Language': locale,
      },
    },
  );
}

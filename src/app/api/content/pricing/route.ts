/**
 * GET /api/content/pricing?locale= — тарифы и пакеты занятий для мобильного приложения.
 *
 * Тот же состав, что на `/pricing`: `buildPricingContent` сам отдаёт только включённые разделы,
 * поэтому отдельной проверки модуля здесь нет.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { defaultLocale, isLocale } from '@/i18n/config';
import { buildPricingContent } from '@/server/content/pricing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status: number, locale?: string) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl.none,
      'X-Content-Type-Options': 'nosniff',
      ...(locale ? { 'Content-Language': locale } : {}),
    },
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  const rawLocale = new URL(request.url).searchParams.get('locale') ?? '';
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  try {
    const content = await buildPricingContent(locale);
    return json(content, 200, locale);
  } catch (e) {
    console.error('[content/pricing]', e);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
  }
}

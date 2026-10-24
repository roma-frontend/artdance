/**
 * GET /api/content/blog?locale=&category=&q= — список опубликованных статей для мобильного приложения.
 *
 * Тот же запрос, что на `/blog`: `getBlogList`. Страница публичная, модуль не проверяется.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { defaultLocale, isLocale } from '@/i18n/config';
import { getBlogList } from '@/server/queries/blog';

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
  const params = new URL(request.url).searchParams;
  const rawLocale = params.get('locale') ?? '';
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const category = params.get('category')?.trim() || undefined;
  const q = params.get('q')?.trim() || undefined;

  try {
    const result = await getBlogList({ locale, category, q });
    return json(result, 200, locale);
  } catch (e) {
    if (isDomainError(e)) return json({ error: e.code, messageKey: e.messageKey, params: e.params }, httpStatusFor(e.code));
    console.error('[content/blog]', e);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
  }
}

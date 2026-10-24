/**
 * GET /api/content/become-instructor?locale= — лендинг для преподавателей в мобильном приложении.
 *
 * Тот же состав, что на `/become-instructor`: собирается `buildBecomeInstructorContent`.
 * Страница публичная, модуль не проверяется.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { defaultLocale, isLocale } from '@/i18n/config';
import { buildBecomeInstructorContent } from '@/server/content/become-instructor';

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
    const content = await buildBecomeInstructorContent(locale);
    return json(content, 200, locale);
  } catch (e) {
    if (isDomainError(e)) return json({ error: e.code, messageKey: e.messageKey, params: e.params }, httpStatusFor(e.code));
    console.error('[content/become-instructor]', e);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
  }
}

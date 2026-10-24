/**
 * GET /api/content/gift-cards?locale= — подарочные карты для мобильного приложения.
 *
 * Тот же состав, что на `/gift-cards`: собирается `buildGiftCardsContent`. Модуль `shop`
 * проверяется так же, как на странице; выключенный модуль отвечает `FEATURE_DISABLED`.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { defaultLocale, isLocale } from '@/i18n/config';
import { buildGiftCardsContent } from '@/server/content/gift-cards';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';

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
    await assertEntitlementOrThrow('shop');
    const content = await buildGiftCardsContent(locale);
    return json(content, 200, locale);
  } catch (e) {
    if (isDomainError(e)) return json({ error: e.code, messageKey: e.messageKey, params: e.params }, httpStatusFor(e.code));
    console.error('[content/gift-cards]', e);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
  }
}

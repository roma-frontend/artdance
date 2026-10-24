/**
 * API: POST /api/gift-cards/redeem — проверка подарочной карты из мобильного приложения.
 *
 * Зеркало веб-действия `redeemGiftCard`: тот же лимит, та же проверка модуля `shop`
 * и та же логика поиска карты (`checkGiftCardCode`). Успех: 200 с балансом.
 * Отказ: 404 (код не найден), 410 (срок истёк), 409 (карта уже использована).
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { checkGiftCardCode, redeemCodeSchema, type GiftCardCheckFailure } from '@/server/gift-card/redeem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FAILURES: Record<GiftCardCheckFailure, { error: string; status: number }> = {
  'giftCards.redeem.notFound': { error: 'NOT_FOUND', status: 404 },
  'giftCards.redeem.expired': { error: 'EXPIRED', status: 410 },
  'giftCards.redeem.alreadyRedeemed': { error: 'ALREADY_REDEEMED', status: 409 },
};

function json(body: object, status: number, headers?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': cacheControl.none, 'X-Content-Type-Options': 'nosniff', ...headers },
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const identifier = clientIdentifier(request.headers);
  const limit = await checkRateLimit('contactForm', identifier);
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'contactForm'),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const parsed = redeemCodeSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required', field: 'giftCardCode' }, 400);
  }

  try {
    await assertEntitlementOrThrow('shop');
    const result = await checkGiftCardCode(parsed.data.code);
    if (result.ok) return json(result, 200);
    const failure = FAILURES[result.messageKey];
    return json({ error: failure.error, messageKey: result.messageKey }, failure.status);
  } catch (error) {
    if (isDomainError(error)) {
      return json({ error: error.code, messageKey: error.messageKey, params: error.params }, httpStatusFor(error.code));
    }
    console.error('[api:gift-cards/redeem]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
  }
}

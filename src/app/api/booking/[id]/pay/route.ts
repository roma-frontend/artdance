/**
 * BOOKING PAYMENT — создание платежа за активную неоплаченную бронь.
 *
 * Занятия создаются CONFIRMED (см. createBookingFromHold), предоплата для них необязательна.
 * Аренда зала создаётся PENDING и подтверждается только оплатой. Этот маршрут отправляет
 * бронь провайдеру. Подтверждение приходит с webhook'а, а не с редиректа.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { paymentMethods } from '@/domain/enums';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { requireCaller } from '@/lib/auth/guards';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { createBookingPayment } from '@/server/payments/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  method: z.enum(paymentMethods as unknown as [string, ...string[]]),
  locale: z.string().min(2).max(8).optional(),
  fromApp: z.boolean().optional(),
});

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limit = await checkRateLimit('paymentIntent', clientIdentifier(request.headers));
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'paymentIntent'),
    );
  }

  const { id } = await params;
  if (!id) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

  try {
    const caller = await requireCaller();
    const result = await createBookingPayment({
      bookingId: id,
      userId: caller.id,
      method: parsed.data.method as (typeof paymentMethods)[number],
      locale: parsed.data.locale ?? caller.locale ?? 'hy',
      fromApp: parsed.data.fromApp === true,
    });
    return json(result, 200);
  } catch (error) {
    if (isDomainError(error)) {
      return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
    }
    console.error('[booking/pay]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

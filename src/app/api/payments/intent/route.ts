/**
 * PAYMENT INTENT — отправка заказа провайдеру.
 *
 * Маршрут объявлен в `apiRoutes.paymentIntent` с первой версии конфигурации и до
 * этого не существовал: оформление заканчивалось словом «скоро». Он принимает
 * уже созданный заказ (`createOrderAction`), optionally списывает баланс кошелька
 * и возвращает, куда уходит клиент.
 *
 * Здесь нет ни редиректа, ни «успеха»: подтверждение оплаты приходит с
 * webhook'а или из сверки, а не от редиректа клиента — redirect не является
 * доказательством оплаты, и это правило проекта, а не осторожность.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { paymentMethods } from '@/domain/enums';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { getCaller } from '@/lib/auth/guards';
import { publishableKeyFor } from '@/lib/payments/publishable-key';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { createOrderPayment } from '@/server/payments/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  orderId: z.string().min(1).max(64),
  method: z.enum(paymentMethods as unknown as [string, ...string[]]),
  locale: z.string().min(2).max(8).optional(),
  useWallet: z.boolean().optional(),
  fromApp: z.boolean().optional(),
  /** Диплинк приложения для возврата после оплаты (например artdance://payment/return). */
  returnTo: z.string().min(1).max(200).optional(),
  /**
   * Идентификатор гостя — тот же, что у его корзины.
   *
   * Оформление гостю разрешено (вход не требуется), значит и оплатить заказ он
   * должен уметь. Признак владельца здесь — совпадение с ключом, по которому
   * заказ создан: подобрать его так же трудно, как угадать номер заказа, и он
   * не открывает доступ к чужому `userId`-заказу.
   */
  anonymousId: z.string().min(8).max(128).optional(),
  /** Оплата в нативной форме (PaymentSheet): возвращается clientSecret без redirect. */
  inAppSheet: z.boolean().optional(),
});

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

export async function POST(request: Request) {
  const caller = await getCaller();

  const limit = await checkRateLimit('paymentIntent', clientIdentifier(request.headers));
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'paymentIntent'),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

  /* Ни сессии, ни гостевого ключа — платить не от чьего имени. */
  if (!caller && !parsed.data.anonymousId) {
    return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  }

  try {
    const result = await createOrderPayment({
      orderId: parsed.data.orderId,
      userId: caller?.id ?? null,
      anonymousId: parsed.data.anonymousId ?? null,
      method: parsed.data.method as (typeof paymentMethods)[number],
      locale: parsed.data.locale ?? caller?.locale ?? 'hy',
      /* Кошелёк гостю недоступен: баланс принадлежит аккаунту. */
      useWallet: parsed.data.useWallet === true,
      fromApp: parsed.data.fromApp === true,
      returnTo: parsed.data.returnTo,
      inAppSheet: parsed.data.inAppSheet === true,
    });
    return json({ ...result, publishableKey: publishableKeyFor(result.provider) }, 200);
  } catch (error) {
    if (isDomainError(error)) {
      return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
    }
    console.error('[payments:intent]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

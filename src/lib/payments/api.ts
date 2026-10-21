/**
 * КЛИЕНТ ПЛАТЕЖНОГО КОНТУРА — три вызова из браузера.
 *
 * Один модуль, а не `fetch` в компонентах: у каждого из трёх запросов есть
 * свойства, которые легко потерять при копировании, — `no-store` (платёж не
 * кешируется), разбор ошибки в код и ключ перевода вместо текста, и запрет
 * считать ответ «оплата прошла». Последнее важнее остального: редирект
 * клиента доказательством оплаты не является (правило проекта), поэтому
 * `createPaymentIntent` возвращает адрес, а не статус успеха.
 */

import type { PaymentMethod } from '@/domain/enums';
import type { MessageKey } from '@/i18n/types';

import type { PaymentProviderId } from './types';

export interface PaymentIntentResponse {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  /** Сумма, ушедшая провайдеру (после списания баланса). */
  amount: number;
  walletApplied: number;
  provider: PaymentProviderId;
  providerTransactionId: string | null;
  /** Куда отправить клиента. `null` — оплата inline (QR) или заказ закрыт балансом. */
  redirectUrl: string | null;
  qrPayload: string | null;
  status: string;
  /** Баланса хватило целиком: провайдер не нужен. */
  settledByWallet: boolean;
}

/** Ошибка контура в форме, пригодной для показа: код и ключ перевода. */
export interface PaymentApiError {
  code: string;
  messageKey: MessageKey;
}

export type PaymentApiResult<T> = { ok: true; data: T } | { ok: false; error: PaymentApiError };

function fallbackError(): PaymentApiError {
  return { code: 'INTERNAL', messageKey: 'errors.generic.description' };
}

async function readError(response: Response): Promise<PaymentApiError> {
  const body = (await response.json().catch(() => null)) as { error?: unknown; messageKey?: unknown } | null;
  if (typeof body?.error === 'string' && typeof body.messageKey === 'string') {
    return { code: body.error, messageKey: body.messageKey as MessageKey };
  }
  return fallbackError();
}

/**
 * Создаёт (или возвращает уже созданный) платёж по заказу.
 *
 * Идемпотентность принадлежит серверу: повторный клик возвращает ту же попытку,
 * а не отправляет у провайдера вторую. Клиент не пытается её изобразить —
 * иначе на повторе после сетевого сбоя вернулся бы «новый» платёж.
 */
export async function createPaymentIntent(input: {
  orderId: string;
  method: PaymentMethod;
  useWallet?: boolean;
  /**
   * Гостевой ключ. Без сессии это единственное доказательство владения
   * заказом; с сессией сервер его игнорирует.
   */
  anonymousId?: string | null;
}): Promise<PaymentApiResult<PaymentIntentResponse>> {
  let response: Response;
  try {
    response = await fetch('/api/payments/intent', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, error: fallbackError() };
  }

  if (!response.ok) return { ok: false, error: await readError(response) };

  const data = (await response.json().catch(() => null)) as PaymentIntentResponse | null;
  if (!data || typeof data.orderId !== 'string') return { ok: false, error: fallbackError() };
  return { ok: true, data };
}

/**
 * Сверка статуса платежа. Нужна странице возврата: провайдер редиректит
 * клиента раньше, чем приходит webhook, и без сверки человек видел бы
 * «обрабатывается» даже после успешной оплаты.
 */
export async function reconcilePaymentRequest(paymentId: string): Promise<PaymentApiResult<{ status: string }>> {
  let response: Response;
  try {
    response = await fetch('/api/payments/reconcile', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paymentId }),
    });
  } catch {
    return { ok: false, error: fallbackError() };
  }

  if (!response.ok) return { ok: false, error: await readError(response) };

  const data = (await response.json().catch(() => null)) as { status?: unknown } | null;
  if (!data || typeof data.status !== 'string') return { ok: false, error: fallbackError() };
  return { ok: true, data: { status: data.status } };
}

/**
 * КЛИЕНТ ПЛАТЕЖНОГО КОНТУРА — вызовы из браузера.
 *
 * Один модуль, а не `fetch` в компонентах: у каждого запроса есть свойства, которые легко
 * потерять при копировании, — `no-store`, разбор ошибки в код и ключ перевода вместо текста,
 * и запрет считать ответ «оплата прошла». Ответ с секретом — это вход в форму оплаты, а не
 * подтверждение: оплату подтверждают webhook и сверка на сервере.
 *
 * Оплата только встроенная. Каждый запрос просит `inAppSheet`, сервер не отдаёт адрес
 * провайдера, поэтому поля `redirectUrl` здесь нет: клиент никуда не переходит.
 */

import { apiRoutes } from '@/config/routes';
import type { PaymentMethod } from '@/domain/enums';
import type { MessageKey } from '@/i18n/types';
import { getAnonymousId } from '@/lib/client/anonymous-id';

import type { TestCardScenario } from './test-card';
import type { PaymentProviderId } from './types';

export interface CreatePaymentIntentInput {
  orderId: string;
  method: PaymentMethod;
  useWallet?: boolean;
  /** Гостевой ключ. По умолчанию — ключ этого браузера; с сессией сервер его игнорирует. */
  anonymousId?: string;
}

export interface ConfirmTestPaymentInput {
  providerTransactionId: string;
  /** Исход тестовой карты. Номер карты на сервер не уходит. */
  scenario: TestCardScenario;
  anonymousId?: string;
}

/** Общая часть ответа заказа и брони: по ней клиент выбирает форму оплаты. */
export interface PaymentAttempt {
  paymentId: string;
  /** Сумма, ушедшая провайдеру (после списания баланса). */
  amount: number;
  provider: PaymentProviderId;
  providerTransactionId: string | null;
  status: string;
  /** Секрет попытки для встроенной формы. Нет, когда оплата не нужна (баланс, наличные при получении). */
  clientSecret?: string | null;
  /** Публикуемый ключ Stripe (`pk_`). У остальных провайдеров — `null`. */
  publishableKey?: string | null;
  /** Баланса хватило целиком: провайдер не нужен. У брони этого поля нет. */
  settledByWallet?: boolean;
}

export interface PaymentIntentResponse extends PaymentAttempt {
  orderId: string;
  orderNumber: string;
  walletApplied: number;
}

export interface BookingPaymentResponse extends PaymentAttempt {
  bookingId: string;
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

/** Гостевой ключ браузера. Пустое значение не шлём: сервер требует минимум 8 символов. */
function browserAnonymousId(): string | undefined {
  return getAnonymousId() || undefined;
}

/** Минимальная проверка формы: пришедший не-JSON иначе молча стал бы «успехом». */
function hasKey(data: unknown, key: string): boolean {
  return typeof data === 'object' && data !== null && typeof (data as Record<string, unknown>)[key] === 'string';
}

async function postJson<T>(url: string, body: object, requiredKey: string): Promise<PaymentApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: fallbackError() };
  }

  if (!response.ok) return { ok: false, error: await readError(response) };

  const data: unknown = await response.json().catch(() => null);
  if (!hasKey(data, requiredKey)) return { ok: false, error: fallbackError() };
  return { ok: true, data: data as T };
}

/**
 * Создаёт попытку оплаты по заказу. Заказ оформляет вызывающий код один раз, а повтор
 * после отказа вызывает эту функцию снова, не `createOrderAction`.
 *
 * Сервер при `inAppSheet` создаёт попытку заново: Stripe по idempotencyKey вернёт ту же
 * PaymentIntent, mock выдаст новую транзакцию. Повторный клик гасит интерфейс, а не сервер.
 */
export function createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentApiResult<PaymentIntentResponse>> {
  return postJson<PaymentIntentResponse>(
    apiRoutes.paymentIntent(),
    { ...input, anonymousId: input.anonymousId ?? browserAnonymousId(), inAppSheet: true },
    'orderId',
  );
}

/**
 * Сверка статуса платежа. Нужна странице результата: клиент возвращается сразу после
 * подтверждения, а webhook может прийти позже, и без сверки человек видел бы
 * «обрабатывается» даже после успешной оплаты.
 */
export function reconcilePaymentRequest(paymentId: string): Promise<PaymentApiResult<{ status: string }>> {
  return postJson<{ status: string }>('/api/payments/reconcile', { paymentId }, 'status');
}

/** Попытка оплаты за неоплаченную бронь. Только владелец-аккаунт; адрес провайдера не возвращается. */
export function startBookingPayment(input: {
  bookingId: string;
  method: PaymentMethod;
}): Promise<PaymentApiResult<BookingPaymentResponse>> {
  return postJson<BookingPaymentResponse>(
    apiRoutes.bookingPay(input.bookingId),
    { method: input.method, inAppSheet: true },
    'bookingId',
  );
}

/**
 * Тестовое подтверждение заглушки (mock). Клиенту доверять нельзя: итог сверяет сервер,
 * `status` лишь решает, что показать.
 */
export function confirmTestPayment(input: ConfirmTestPaymentInput): Promise<PaymentApiResult<{ status: string }>> {
  return postJson<{ status: string }>(
    apiRoutes.paymentDevConfirm(),
    { ...input, anonymousId: input.anonymousId ?? browserAnonymousId() },
    'status',
  );
}

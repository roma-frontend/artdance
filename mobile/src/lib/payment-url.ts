import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { promptTestCard } from '@/components/payments/test-card-stub';

import { confirmTestPayment, reconcileMyPayment } from './orders';
import { isNativeStripeAvailable, presentStripeSheet } from './stripe-sheet';

/**
 * Ответ сервера на старт оплаты. `clientSecret` есть только для нативной формы Stripe,
 * `redirectUrl` — для страницы провайдера.
 */
export type PaymentStart = {
  redirectUrl: string | null;
  providerTransactionId: string | null;
  clientSecret?: string | null;
};

/**
 * Итог оплаты в приложении. `PAID` подтверждён сверкой с провайдером.
 * `PENDING` — возврат получен, статус ещё не известен. `UNAVAILABLE` — оплату открыть не удалось.
 */
export type PaymentOutcome = 'PAID' | 'PENDING' | 'FAILED' | 'CANCELED' | 'UNAVAILABLE';

/** Страница провайдера открывается только по https; http допустим в разработке для mock-провайдера. */
export function isSafePaymentUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || (__DEV__ && protocol === 'http:');
  } catch {
    return false;
  }
}

/** Адрес, куда провайдер вернёт клиента: диплинк приложения (в Expo Go это exp://...). */
export function paymentReturnUrl(): string {
  return Linking.createURL('payment/return');
}

function outcomeOf(status: string): PaymentOutcome {
  if (status === 'PAID') return 'PAID';
  if (status === 'FAILED' || status === 'CANCELLED') return 'FAILED';
  return 'PENDING';
}

/** Сверка с провайдером. Сбой сверки не считается провалом: статус придёт вебхуком. */
async function settle(transactionId: string): Promise<PaymentOutcome> {
  try {
    return outcomeOf(await reconcileMyPayment(transactionId));
  } catch {
    return 'PENDING';
  }
}

/**
 * Открывает страницу оплаты внутри приложения (без выхода в браузер). После возврата
 * сверяет платёж с провайдером: сам редирект не считается оплатой.
 */
export async function openPaymentUrl(
  url: string | null | undefined,
  transactionId: string | null | undefined,
): Promise<PaymentOutcome> {
  if (!url || !isSafePaymentUrl(url)) return 'UNAVAILABLE';
  const session = await WebBrowser.openAuthSessionAsync(url, paymentReturnUrl()).catch(() => null);
  if (!session) return 'UNAVAILABLE';
  if (session.type !== 'success') return 'CANCELED';
  if (!transactionId) return 'PENDING';
  return settle(transactionId);
}

/**
 * Единая точка оплаты для экранов:
 * - нативная форма Stripe (dev/production сборка);
 * - тестовая заглушка в Expo Go (сервер подтверждает тестовой картой);
 * - страница провайдера, если серверу нужен редирект (mock и прочие способы).
 * Итог всегда сверяется с провайдером, даже когда форма сообщила об успехе.
 */
export async function startPayment(start: PaymentStart): Promise<PaymentOutcome> {
  const transactionId = start.providerTransactionId;
  if (start.clientSecret && transactionId) {
    if (isNativeStripeAvailable()) {
      const result = await presentStripeSheet(start.clientSecret, paymentReturnUrl());
      if (result === 'COMPLETED') return settle(transactionId);
      if (result === 'CANCELED') return 'CANCELED';
      return result === 'FAILED' ? 'FAILED' : 'UNAVAILABLE';
    }

    const scenario = await promptTestCard();
    if (!scenario) return 'CANCELED';
    try {
      const status = await confirmTestPayment(transactionId, scenario);
      // Отказ тестовой карты: платёж не подтверждён, сверка не нужна.
      if (status === 'declined') return 'FAILED';
      return settle(transactionId);
    } catch {
      return 'UNAVAILABLE';
    }
  }
  return openPaymentUrl(start.redirectUrl, transactionId);
}

/** Текст пользователю по итогу оплаты. */
export function paymentOutcomeText(
  outcome: PaymentOutcome,
  t: { bookPaid: string; bookPayPending: string; bookPayDeclined: string; bookPayLater: string; bookPayFailed: string },
): string {
  switch (outcome) {
    case 'PAID':
      return t.bookPaid;
    case 'PENDING':
      return t.bookPayPending;
    case 'FAILED':
      return t.bookPayDeclined;
    case 'CANCELED':
      return t.bookPayLater;
    case 'UNAVAILABLE':
      return t.bookPayFailed;
  }
}

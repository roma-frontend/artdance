import * as Linking from 'expo-linking';

import { presentPaymentSheet, type SheetOutcome } from '@/components/payments/payment-sheet';
import type { TestScenario } from '@/components/payments/test-card-stub';

import { confirmTestPayment, reconcileMyPayment } from './orders';
import { confirmCardPayment, isNativeStripeAvailable } from './stripe-sheet';

/**
 * Ответ сервера на старт оплаты. `clientSecret` и `provider` нужны для встроенной формы оплаты;
 * `settledByWallet` значит, что заказ полностью оплачен кошельком и провайдер не участвует.
 */
export type PaymentStart = {
  provider?: string | null;
  providerTransactionId: string | null;
  clientSecret?: string | null;
  amount?: number;
  settledByWallet?: boolean;
};

/**
 * Итог оплаты в приложении. `PAID` подтверждён сверкой с провайдером. `PENDING` — сверка
 * не ответила, статус придёт вебхуком. `UNAVAILABLE` — оплату открыть не удалось.
 */
export type PaymentOutcome = 'PAID' | 'PENDING' | 'FAILED' | 'CANCELED' | 'UNAVAILABLE';

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
 * Оплата тестовой картой из заглушки: сервер подтверждает платёж (mock или тестовый PaymentIntent Stripe).
 * Отказ карты возвращает DECLINED; исключение сервера попадает в форму и становится FAILED.
 */
async function submitTestCard(transactionId: string, scenario: TestScenario | null): Promise<SheetOutcome> {
  if (!scenario) return 'FAILED';
  const status = await confirmTestPayment(transactionId, scenario);
  return status === 'declined' ? 'DECLINED' : 'PAID';
}

/**
 * Оплата в приложении, без браузера. Открывает встроенную форму: нативную Stripe (провайдер stripe
 * в dev или production сборке) либо заглушку тестовой карты (Expo Go и mock). Успешная форма ещё не оплата:
 * итог сверяется с провайдером.
 */
export async function startPayment(start: PaymentStart): Promise<PaymentOutcome> {
  if (start.settledByWallet) return 'PAID';
  const transactionId = start.providerTransactionId;
  const clientSecret = start.clientSecret;
  if (!transactionId || !clientSecret) return 'UNAVAILABLE';

  const native = start.provider === 'stripe' && isNativeStripeAvailable();
  const outcome = await presentPaymentSheet({
    amount: start.amount ?? 0,
    mode: native ? 'native' : 'stub',
    submit: (scenario) => (native ? confirmCardPayment(clientSecret) : submitTestCard(transactionId, scenario)),
  });

  if (outcome === 'PAID') return settle(transactionId);
  if (outcome === 'DECLINED') return 'FAILED';
  if (outcome === 'CANCELED') return 'CANCELED';
  return 'UNAVAILABLE';
}

/** Текст неуспешного итога для экрана заказа: заказ сохранён, поэтому повтор описан прямо. */
export function orderPaymentError(
  outcome: Exclude<PaymentOutcome, 'PAID' | 'PENDING'>,
  t: { declined: string; canceled: string; unavailable: string },
): string {
  if (outcome === 'FAILED') return t.declined;
  if (outcome === 'CANCELED') return t.canceled;
  return t.unavailable;
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

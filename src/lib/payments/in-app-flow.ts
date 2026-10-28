/**
 * Решение клиента по ответу сервера: какую форму открыть. Чистая функция без React и сети,
 * чтобы правило «на сайт провайдера не переходим» проверялось тестом.
 *
 * Выбор идёт по секрету попытки и провайдеру, а не по адресу. Без секрета встроенной формы
 * нет, и такой заказ честно помечается как недоступный, а не оплачивается молча.
 */

import type { PaymentMethod } from '@/domain/enums';

import type { PaymentAttempt } from './api';

export type PaymentFlow =
  /** Оплата не нужна: баланс закрыл заказ или это наличные при получении. */
  | { kind: 'done' }
  /** Заглушка (mock): форма с тестовыми картами. */
  | { kind: 'test-card'; providerTransactionId: string; clientSecret: string }
  /** Stripe Payment Element с публикуемым ключом сервера. */
  | { kind: 'stripe'; providerTransactionId: string; clientSecret: string; publishableKey: string }
  /** Встроенной формы для этого провайдера нет, например банковский метод без адаптера. */
  | { kind: 'unavailable' };

type FlowAttempt = Pick<
  PaymentAttempt,
  'provider' | 'providerTransactionId' | 'clientSecret' | 'publishableKey' | 'settledByWallet'
>;

export function paymentFlow(attempt: FlowAttempt, method: PaymentMethod): PaymentFlow {
  if (attempt.settledByWallet) return { kind: 'done' };
  /* Наличные при получении: провайдер не участвует, платить сейчас не нужно. */
  if (method === 'CASH_ON_DELIVERY') return { kind: 'done' };

  const { provider, providerTransactionId, clientSecret, publishableKey } = attempt;
  if (!providerTransactionId || !clientSecret) return { kind: 'unavailable' };

  if (provider === 'mock') return { kind: 'test-card', providerTransactionId, clientSecret };
  if (provider === 'stripe' && publishableKey) {
    return { kind: 'stripe', providerTransactionId, clientSecret, publishableKey };
  }
  return { kind: 'unavailable' };
}

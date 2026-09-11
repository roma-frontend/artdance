/**
 * РУЧНОЙ ВОЗВРАТ — расчёт предела и порога согласования.
 *
 * Вынесено из действия в домен по одной причине: это арифметика денег, а её
 * нельзя проверять только через БД. Тест на «возврат больше оплаченного»
 * обязателен, а не желателен: ошибка здесь означает выплату из кассы платформы
 * без основания.
 *
 * Три правила, каждое со своим сценарием отказа:
 *
 * 1. **Возврат считается от ОПЛАЧЕННОГО, а не от суммы заказа.** Клиент мог
 *    оплатить часть, доплатить после переноса или использовать подарочную карту.
 *    Возврат «по цене заказа» в этих случаях больше полученного.
 * 2. **Уже возвращённое вычитается.** Иначе два частичных возврата по 60% дают
 *    120% — и это находят не в коде, а в выписке.
 * 3. **Провалившийся и отменённый возврат не уменьшают предел.** Денег по ним не
 *    ушло, и вычитать их значит запретить повторную попытку после сбоя банка.
 */

import { clampNonNegative, money, subtract, type Money } from '@/domain/money';

/** Состояния возврата, при которых деньги считаются ушедшими или в пути. */
const COUNTED_REFUND_STATUSES: readonly string[] = [
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'CHARGEBACK',
];

export interface RefundRecord {
  amount: Money;
  status: string;
}

/**
 * Сколько ещё можно вернуть. `paid` — фактически полученное по платежу,
 * `refunds` — все записи возвратов по этому заказу.
 */
export function refundableAmount(paid: Money, refunds: readonly RefundRecord[]): Money {
  const counted = refunds
    .filter((refund) => COUNTED_REFUND_STATUSES.includes(refund.status))
    .reduce((sum, refund) => sum + money(refund.amount), 0);

  return clampNonNegative(subtract(money(paid), counted));
}

/** Возврат допустим: положительный и не превышает остаток. */
export function isRefundAllowed(amount: Money, refundable: Money): boolean {
  if (!Number.isInteger(amount) || amount <= 0) return false;
  return amount <= refundable;
}

/**
 * Нужен ли второй администратор. Порог передаётся аргументом, а не читается из
 * конфига: функция обязана быть чистой, чтобы её можно было проверить на границе
 * (ровно порог — ещё можно, порог плюс один драм — уже нельзя).
 */
export function requiresApproval(amount: Money, threshold: Money): boolean {
  return money(amount) > money(threshold);
}

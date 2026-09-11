/**
 * Расчёт ручного возврата.
 *
 * Тест обязателен по правилам проекта: это деньги. Проверяются те случаи,
 * которые дороже всего стоят в реальности — второй частичный возврат, повторная
 * попытка после отказа банка и граница порога согласования.
 */

import { describe, expect, it } from 'vitest';

import { isRefundAllowed, refundableAmount, requiresApproval } from './refund';

describe('refundableAmount', () => {
  it('без возвратов даёт всю оплаченную сумму', () => {
    expect(refundableAmount(12_000, [])).toBe(12_000);
  });

  it('вычитает уже возвращённое', () => {
    expect(refundableAmount(12_000, [{ amount: 5_000, status: 'REFUNDED' }])).toBe(7_000);
  });

  it('складывает несколько частичных возвратов', () => {
    const refunds = [
      { amount: 4_000, status: 'REFUNDED' },
      { amount: 3_000, status: 'PENDING' },
    ];

    expect(refundableAmount(12_000, refunds)).toBe(5_000);
  });

  it('не вычитает провалившийся возврат: денег по нему не ушло', () => {
    const refunds = [
      { amount: 12_000, status: 'FAILED' },
      { amount: 12_000, status: 'CANCELLED' },
    ];

    expect(refundableAmount(12_000, refunds)).toBe(12_000);
  });

  it('никогда не уходит ниже нуля', () => {
    expect(refundableAmount(5_000, [{ amount: 9_000, status: 'REFUNDED' }])).toBe(0);
  });

  it('ожидающий возврат уменьшает предел: иначе двойной возврат по одному заказу', () => {
    expect(refundableAmount(10_000, [{ amount: 10_000, status: 'PENDING' }])).toBe(0);
  });
});

describe('isRefundAllowed', () => {
  it('пропускает сумму в пределах остатка', () => {
    expect(isRefundAllowed(5_000, 7_000)).toBe(true);
  });

  it('разрешает вернуть остаток целиком', () => {
    expect(isRefundAllowed(7_000, 7_000)).toBe(true);
  });

  it('отклоняет сумму больше остатка', () => {
    expect(isRefundAllowed(7_001, 7_000)).toBe(false);
  });

  it('отклоняет ноль и отрицательное', () => {
    expect(isRefundAllowed(0, 7_000)).toBe(false);
    expect(isRefundAllowed(-100, 7_000)).toBe(false);
  });

  it('отклоняет нецелое: драм не делится', () => {
    expect(isRefundAllowed(1_000.5, 7_000)).toBe(false);
  });
});

describe('requiresApproval', () => {
  it('на пороге согласование не нужно', () => {
    expect(requiresApproval(200_000, 200_000)).toBe(false);
  });

  it('на один драм выше порога — нужно', () => {
    expect(requiresApproval(200_001, 200_000)).toBe(true);
  });

  it('ниже порога — не нужно', () => {
    expect(requiresApproval(1_000, 200_000)).toBe(false);
  });
});

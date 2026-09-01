import { describe, expect, it } from 'vitest';

import { commission, tax } from '@/config/business';
import {
  add,
  applyRate,
  breakdownVat,
  distributeProportionally,
  MoneyError,
  money,
  multiply,
  roundToPriceStep,
  splitCommission,
} from './money';

describe('money', () => {
  it('отклоняет нецелые суммы: драм не имеет разменной единицы', () => {
    expect(() => money(12_000.5)).toThrow(MoneyError);
    expect(() => money(Number.NaN)).toThrow(MoneyError);
    expect(money(12_000)).toBe(12_000);
  });

  it('умножение требует целого неотрицательного количества', () => {
    expect(multiply(15_000, 3)).toBe(45_000);
    expect(() => multiply(15_000, -1)).toThrow(MoneyError);
    expect(() => multiply(15_000, 1.5)).toThrow(MoneyError);
  });

  it('округляет цену до шага прайс-листа', () => {
    expect(roundToPriceStep(12_049)).toBe(12_000);
    expect(roundToPriceStep(12_050)).toBe(12_100);
  });

  it('извлекает НДС из цены, включающей налог', () => {
    const result = breakdownVat(12_000, 0.2, true);
    expect(result.gross).toBe(12_000);
    expect(result.net + result.vat).toBe(result.gross);
    expect(result.net).toBe(10_000);
    expect(result.vat).toBe(2_000);
  });

  it('начисляет НДС сверху, если цены без налога', () => {
    const result = breakdownVat(10_000, 0.2, false);
    expect(result.net).toBe(10_000);
    expect(result.vat).toBe(2_000);
    expect(result.gross).toBe(12_000);
  });

  it('использует ставку НДС из бизнес-правил по умолчанию', () => {
    expect(breakdownVat(12_000).rate).toBe(tax.vatRate);
  });
});

describe('commission', () => {
  it('делит сумму занятия по ставке инструктора без потери копеек', () => {
    const split = splitCommission(12_000, 'CLASS_BOOKING');
    expect(split.rate).toBe(commission.instructorRate);
    expect(split.platformFee + split.providerNet).toBe(split.gross);
  });

  it('не берёт комиссию с собственных товаров', () => {
    const split = splitCommission(18_000, 'PRODUCT');
    expect(split.platformFee).toBe(0);
    expect(split.providerNet).toBe(18_000);
  });

  it('соблюдает минимальную комиссию за транзакцию', () => {
    const split = splitCommission(1_000, 'CLASS_BOOKING');
    expect(split.platformFee).toBe(commission.minimumFee);
  });

  it('никогда не выставляет комиссию больше суммы операции', () => {
    const split = splitCommission(100, 'CLASS_BOOKING');
    expect(split.platformFee).toBeLessThanOrEqual(split.gross);
    expect(split.providerNet).toBeGreaterThanOrEqual(0);
  });
});

describe('distributeProportionally', () => {
  it('сумма частей всегда равна распределяемой сумме', () => {
    const weights = [12_000, 15_000, 18_000];
    const parts = distributeProportionally(6_050, weights);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(6_050);
  });

  it('корректно работает при нулевых весах', () => {
    expect(distributeProportionally(1_000, [0, 0])).toEqual([0, 0]);
  });

  it('распределяет скидку заказа без расхождения с итогом', () => {
    const lines = [18_000, 30_000, 12_500];
    const subtotal = add(...lines);
    const discount = applyRate(subtotal, 0.1);
    const parts = distributeProportionally(discount, lines);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(discount);
  });
});

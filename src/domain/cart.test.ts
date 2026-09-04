import { describe, expect, it } from 'vitest';

import { demoCartTotals } from '../../prisma/fixtures/demo';
import { commerce, promotions, tax } from '@/config/business';

import {
  canAddLine,
  cartItemCount,
  cartSubtotal,
  cartTotals,
  clampQuantity,
  deliveryFeeFor,
  distributeCartDiscount,
  emptyCartTotals,
  promoDiscount,
  welcomePromo,
  type CartLine,
} from './cart';

/** Корзина из утверждённого макета, переведённая в позиции домена. */
const demoLines: readonly CartLine[] = demoCartTotals.items.map((item, index) => ({
  id: `line-${index}`,
  lineType: 'PRODUCT',
  unitPrice: item.unitPrice,
  quantity: item.quantity,
}));

/*
 * Контрольный расчёт.
 *
 * Числа взяты не из головы: это корзина с экрана прототипа, зафиксированная в
 * `prisma/fixtures/demo.ts`. Если формула итогов изменится, расхождение с
 * утверждённым дизайном станет красным тестом, а не спором на приёмке.
 */
describe('итоги корзины совпадают с утверждённым макетом', () => {
  const totals = cartTotals({ lines: demoLines, promo: welcomePromo() });

  it('сумма позиций', () => {
    expect(totals.subtotal).toBe(demoCartTotals.subtotal);
  });

  it('скидка по приветственному коду', () => {
    expect(totals.promoCode).toBe(demoCartTotals.promoCode);
    expect(totals.discount).toBe(demoCartTotals.discount);
  });

  it('доставка бесплатна: сумма выше порога', () => {
    expect(totals.deliveryFee).toBe(demoCartTotals.deliveryFee);
    expect(totals.freeDeliveryRemaining).toBe(0);
  });

  it('итог', () => {
    expect(totals.total).toBe(demoCartTotals.total);
  });

  it('количество единиц, а не позиций', () => {
    expect(totals.lineCount).toBe(3);
    expect(totals.itemCount).toBe(4);
  });

  it('НДС входит в итог, а не прибавляется к нему', () => {
    expect(tax.pricesIncludeVat).toBe(true);
    expect(totals.vat).toBeLessThan(totals.total);
    expect(totals.vatRate).toBe(tax.vatRate);
  });
});

describe('скидка', () => {
  it('процент считается через денежное округление', () => {
    expect(promoDiscount(60_500, { code: 'X', percentOff: 10 })).toBe(6_050);
    /* 12 345 × 10% = 1 234,5 → половина вверх, как у эквайрера. */
    expect(promoDiscount(12_345, { code: 'X', percentOff: 10 })).toBe(1_235);
  });

  it('фиксированная скидка не превращается в доплату клиенту', () => {
    expect(promoDiscount(6_000, { code: 'X', amountOff: 10_000 })).toBe(6_000);
  });

  it('без промокода скидки нет', () => {
    expect(promoDiscount(60_500)).toBe(0);
    expect(promoDiscount(60_500, null)).toBe(0);
  });

  it('распределение по позициям сходится с общей скидкой до драма', () => {
    const parts = distributeCartDiscount(demoLines, 6_050);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(6_050);
    expect(parts).toHaveLength(demoLines.length);
  });

  it('в заказе допустим только один код', () => {
    expect(promotions.maxCodesPerOrder).toBe(1);
  });
});

describe('доставка', () => {
  it('порог считается от суммы после скидки, а не до неё', () => {
    const justUnder = commerce.freeDeliveryThreshold - 1;
    expect(deliveryFeeFor('yerevan', justUnder)).toBe(commerce.deliveryFee.yerevan);
    expect(deliveryFeeFor('yerevan', commerce.freeDeliveryThreshold)).toBe(0);
  });

  it('самовывоз бесплатен независимо от суммы', () => {
    expect(deliveryFeeFor('pickup', 1_000)).toBe(0);
  });

  it('без выбранной зоны доставка не считается: адреса ещё нет', () => {
    expect(deliveryFeeFor(null, 1_000)).toBe(0);
  });

  it('скидка, уронившая сумму ниже порога, делает доставку платной', () => {
    const lines: readonly CartLine[] = [
      { id: 'a', lineType: 'PRODUCT', unitPrice: 26_000, quantity: 1 },
    ];
    const totals = cartTotals({
      lines,
      promo: { code: 'HALF', percentOff: 50 },
      deliveryZone: 'yerevan',
    });
    expect(totals.deliveryFee).toBe(commerce.deliveryFee.yerevan);
    expect(totals.total).toBe(13_000 + commerce.deliveryFee.yerevan);
  });
});

describe('границы корзины', () => {
  it('количество приводится к лимиту, а не отклоняется', () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-5)).toBe(1);
    expect(clampQuantity(2.7)).toBe(2);
    expect(clampQuantity(commerce.maxQuantityPerItem + 5)).toBe(commerce.maxQuantityPerItem);
  });

  it('число позиций ограничено настройкой, а не памятью', () => {
    const full: readonly CartLine[] = Array.from({ length: commerce.maxCartItems }, (_, i) => ({
      id: String(i),
      lineType: 'PRODUCT' as const,
      unitPrice: 1_000,
      quantity: 1,
    }));
    expect(canAddLine(full)).toBe(false);
    expect(canAddLine(full.slice(1))).toBe(true);
  });

  it('пустая корзина даёт нули, а не undefined', () => {
    const totals = emptyCartTotals();
    expect(totals.subtotal).toBe(0);
    expect(totals.total).toBe(0);
    expect(totals.itemCount).toBe(0);
    expect(totals.promoCode).toBeNull();
    expect(cartSubtotal([])).toBe(0);
    expect(cartItemCount([])).toBe(0);
  });
});

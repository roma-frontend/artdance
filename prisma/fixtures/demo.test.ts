/**
 * Тесты фикстур дизайна.
 *
 * Смысл не в проверке констант, а в защите двух вещей:
 *   1. **Формула итогов корзины совпадает с утверждённым макетом.** Если расчёт
 *      скидки или доставки изменится, расхождение с дизайном станет красным
 *      тестом, а не спором на приёмке.
 *   2. **Фикстуры целостны**: каждая ссылка на ассет, инструктора и площадку
 *      существует. Битая ссылка в сиде — это полчаса отладки на пустом экране.
 */

import { describe, expect, it } from 'vitest';

import { assetByName } from '../../design/asset-manifest';
import { commerce, promotions } from '../../src/config/business';
import { add, applyRate, distributeProportionally, multiply } from '../../src/domain/money';

import {
  demoCartTotals,
  demoClasses,
  demoEvents,
  demoInstructors,
  demoProductCategories,
  demoProducts,
  demoReviews,
  demoStyleTiles,
  demoVenues,
} from './demo';

describe('целостность фикстур', () => {
  const instructorSlugs = new Set(demoInstructors.map((i) => i.slug));
  const venueSlugs = new Set(demoVenues.map((v) => v.slug));
  const categorySlugs = new Set(demoProductCategories.map((c) => c.slug));

  it('все ссылки на ассеты существуют в манифесте', () => {
    const referenced = [
      ...demoStyleTiles.map((t) => t.asset),
      ...demoInstructors.map((i) => i.asset),
      ...demoVenues.map((v) => v.asset),
      ...demoClasses.flatMap((c) => [c.asset, c.coverAsset].filter(Boolean) as string[]),
      ...demoProducts.map((p) => p.asset),
      ...demoEvents.map((e) => e.asset),
      ...demoReviews.map((r) => r.asset),
    ];
    for (const name of referenced) {
      expect(assetByName.has(name), `ассет ${name} отсутствует в манифесте`).toBe(true);
    }
  });

  it('занятия ссылаются на существующих инструкторов и площадки', () => {
    for (const item of demoClasses) {
      expect(instructorSlugs.has(item.instructorSlug), item.slug).toBe(true);
      expect(venueSlugs.has(item.venueSlug), item.slug).toBe(true);
    }
  });

  it('товары ссылаются на существующие категории', () => {
    for (const product of demoProducts) {
      expect(categorySlugs.has(product.category), product.slug).toBe(true);
    }
  });

  it('события указывают либо площадку, либо внешнее место', () => {
    for (const event of demoEvents) {
      const hasLocation = Boolean(event.venueSlug) || Boolean(event.locationName);
      expect(hasLocation, event.slug).toBe(true);
      if (event.venueSlug) expect(venueSlugs.has(event.venueSlug), event.slug).toBe(true);
    }
  });

  it('отзывы ссылаются на существующие сущности', () => {
    const classSlugs = new Set(demoClasses.map((c) => c.slug));
    for (const review of demoReviews) {
      const exists =
        review.targetType === 'class'
          ? classSlugs.has(review.targetSlug)
          : instructorSlugs.has(review.targetSlug);
      expect(exists, `${review.authorName} → ${review.targetSlug}`).toBe(true);
    }
  });

  it('слаги уникальны', () => {
    const all = [
      ...demoInstructors.map((i) => i.slug),
      ...demoVenues.map((v) => v.slug),
      ...demoClasses.map((c) => c.slug),
      ...demoProducts.map((p) => p.slug),
      ...demoEvents.map((e) => e.slug),
    ];
    expect(new Set(all).size).toBe(all.length);
  });

  it('SKU уникальны среди всех товаров', () => {
    const skus = demoProducts.flatMap((p) => p.variants.map((v) => v.sku));
    expect(new Set(skus).size).toBe(skus.length);
  });

  it('вариант с ценой товара присутствует у каждого товара', () => {
    for (const product of demoProducts) {
      const hasBase = product.variants.some((v) => v.price === product.price);
      expect(hasBase, product.slug).toBe(true);
    }
  });

  it('занятие без свободных мест помечено как заполненное', () => {
    const full = demoClasses.find((c) => c.slug === 'classical-ballet-intensive');
    expect(full?.spotsLeft).toBe(0);
  });
});

describe('корзина из макета пересчитывается нашей арифметикой', () => {
  const lineTotals = demoCartTotals.items.map((item) => multiply(item.unitPrice, item.quantity));

  it('сумма позиций совпадает с макетом', () => {
    expect(add(...lineTotals)).toBe(demoCartTotals.subtotal);
  });

  it('скидка WELCOME10 совпадает с макетом', () => {
    const percent = promotions.welcomeCode.percentOff / 100;
    expect(applyRate(demoCartTotals.subtotal, percent)).toBe(demoCartTotals.discount);
  });

  it('доставка бесплатна: сумма выше порога', () => {
    expect(demoCartTotals.subtotal).toBeGreaterThanOrEqual(commerce.freeDeliveryThreshold);
    expect(demoCartTotals.deliveryFee).toBe(0);
  });

  it('итог совпадает с макетом', () => {
    const total =
      demoCartTotals.subtotal + demoCartTotals.deliveryFee - demoCartTotals.discount;
    expect(total).toBe(demoCartTotals.total);
  });

  it('скидка распределяется по позициям без расхождения с итогом', () => {
    const parts = distributeProportionally(demoCartTotals.discount, lineTotals);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(demoCartTotals.discount);
  });
});

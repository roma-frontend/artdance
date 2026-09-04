/**
 * КОРЗИНА — итоги заказа как чистая функция.
 *
 * Единственное место, где считаются суммы корзины. Не «удобный хелпер», а
 * требование: те же цифры показываются клиенту в корзине, пересчитываются на
 * сервере перед оформлением, уходят в платёжного провайдера и попадают в
 * бухгалтерский документ. Четыре реализации одной формулы означают четыре
 * разных итога, и разбираться в этом придётся в споре об оплате.
 *
 * Что здесь принципиально:
 *
 * **Ни одного числа.** Порог бесплатной доставки, тарифы зон, лимит количества,
 * ставка НДС — всё из `config/business.ts`. «Сделайте бесплатную доставку от
 * 20 000» должно быть правкой одной строки конфигурации.
 *
 * **Арифметика только через `domain/money.ts`.** Округление скидки в одном месте
 * и одинаково: `Math.round(x * 0.1)` в компоненте и `applyRate` на сервере
 * расходятся на 1 ֏, и этого достаточно, чтобы сумма позиций не сошлась с итогом.
 *
 * **Функция ничего не знает про Prisma, сессию и запросы.** Она принимает
 * позиции и возвращает итоги, поэтому её можно вызвать и в браузере (мгновенный
 * отклик на изменение количества), и на сервере (авторитетный пересчёт). Правило
 * при этом не меняется: клиентский расчёт — предположение, серверный — истина.
 *
 * **Промокод здесь применяется, но не проверяется.** Существует ли код, не истёк
 * ли, не исчерпан ли лимит, подходит ли к этим товарам — вопросы к БД, и они
 * решаются в server action. Сюда приходит уже разрешённая скидка.
 */

import { commerce, promotions, tax } from '@/config/business';
import type { LineItemType } from '@/config/pricing';

import {
  add,
  applyRate,
  breakdownVat,
  clampNonNegative,
  distributeProportionally,
  money,
  multiply,
  subtract,
  type Money,
} from './money';

/** Зона доставки. Ключи и тарифы — `commerce.deliveryFee`. */
export type DeliveryZone = keyof typeof commerce.deliveryFee;

export interface CartLine {
  /** Идентификатор позиции корзины, а не товара: один товар в двух размерах — две позиции. */
  id: string;
  lineType: LineItemType;
  /** Цена за единицу на момент расчёта. Источник — БД, не корзина клиента. */
  unitPrice: Money;
  quantity: number;
}

/**
 * Разрешённая скидка. Ровно одна на заказ (`promotions.maxCodesPerOrder`),
 * поэтому это объект, а не массив: тип отражает правило, а не наоборот.
 */
export interface AppliedPromo {
  code: string;
  /** Процент, 10 = 10%. Взаимоисключающ с `amountOff`. */
  percentOff?: number;
  amountOff?: Money;
}

export interface CartTotalsInput {
  lines: readonly CartLine[];
  promo?: AppliedPromo | null;
  /** Без зоны доставка не считается: корзина ещё не знает адреса. */
  deliveryZone?: DeliveryZone | null;
}

export interface CartTotals {
  /** Штук в корзине, а не позиций: «2 футболки» — это 2. */
  itemCount: number;
  lineCount: number;
  subtotal: Money;
  discount: Money;
  deliveryFee: Money;
  total: Money;
  /**
   * НДС, уже входящий в `total` (`tax.pricesIncludeVat`). Отдельной строкой в
   * счёте, но НЕ прибавляется к итогу: цены в каталоге указаны с налогом.
   */
  vat: Money;
  /**
   * Ставка на момент расчёта. Фиксируется в `Order.vatRate` при создании
   * заказа: изменение конфигурации не должно переписывать историю.
   */
  vatRate: number;
  promoCode: string | null;
  /** Сколько не хватает до бесплатной доставки. `0` — уже бесплатно. */
  freeDeliveryRemaining: Money;
}

/* ───────────────────────────── Позиции ───────────────────────────── */

export function cartLineTotal(line: CartLine): Money {
  return multiply(line.unitPrice, line.quantity);
}

export function cartSubtotal(lines: readonly CartLine[]): Money {
  return add(...lines.map(cartLineTotal));
}

export function cartItemCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * Количество в допустимых границах.
 *
 * Живёт здесь, а не в компоненте счётчика: лимит проверяется и в интерфейсе, и
 * на сервере, а «10» в разметке степпера — это тот самый литерал, который потом
 * не найдут при смене правила.
 */
export function clampQuantity(quantity: number): number {
  const whole = Math.trunc(quantity);
  if (!Number.isFinite(whole) || whole < 1) return 1;
  return Math.min(whole, commerce.maxQuantityPerItem);
}

/** Помещается ли ещё одна позиция в корзину (`commerce.maxCartItems`). */
export function canAddLine(lines: readonly CartLine[]): boolean {
  return lines.length < commerce.maxCartItems;
}

/* ───────────────────────────── Скидка ───────────────────────────── */

/**
 * Сумма скидки. Никогда не больше стоимости товаров: промокод на 10 000 при
 * корзине на 6 000 не должен превращаться в доплату клиенту.
 */
export function promoDiscount(subtotal: Money, promo?: AppliedPromo | null): Money {
  if (!promo) return 0;

  const raw =
    promo.percentOff !== undefined
      ? applyRate(subtotal, promo.percentOff / 100)
      : money(promo.amountOff ?? 0);

  return Math.min(clampNonNegative(raw), money(subtotal));
}

/**
 * Разнесение скидки заказа по позициям.
 *
 * Нужно для возврата и для бухгалтерии: вернуть одну футболку из трёх — значит
 * вернуть её долю скидки, а не полную цену. `distributeProportionally`
 * гарантирует, что сумма частей равна скидке до драма.
 */
export function distributeCartDiscount(
  lines: readonly CartLine[],
  discount: Money,
): readonly Money[] {
  return distributeProportionally(discount, lines.map(cartLineTotal));
}

/* ───────────────────────────── Доставка ───────────────────────────── */

/**
 * Стоимость доставки.
 *
 * Порог считается от суммы товаров ПОСЛЕ скидки: клиент платит именно её, и
 * обещать бесплатную доставку по зачёркнутой сумме — обман, который заметят на
 * шаге оплаты. Самовывоз бесплатен всегда и порога не касается.
 */
export function deliveryFeeFor(zone: DeliveryZone | null | undefined, goodsValue: Money): Money {
  if (!zone) return 0;
  const fee = money(commerce.deliveryFee[zone]);
  if (fee === 0) return 0;
  return goodsValue >= commerce.freeDeliveryThreshold ? 0 : fee;
}

/** Сколько добить до бесплатной доставки — для подсказки в корзине. */
export function freeDeliveryRemaining(goodsValue: Money): Money {
  return clampNonNegative(subtract(commerce.freeDeliveryThreshold, goodsValue));
}

/* ───────────────────────────── Итоги ───────────────────────────── */

export function cartTotals({ lines, promo, deliveryZone }: CartTotalsInput): CartTotals {
  const subtotal = cartSubtotal(lines);
  const discount = promoDiscount(subtotal, promo);
  const goodsValue = subtract(subtotal, discount);
  const deliveryFee = deliveryFeeFor(deliveryZone, goodsValue);
  const total = add(goodsValue, deliveryFee);
  const vat = breakdownVat(total).vat;

  return {
    itemCount: cartItemCount(lines),
    lineCount: lines.length,
    subtotal,
    discount,
    deliveryFee,
    total,
    vat,
    vatRate: tax.vatRate,
    promoCode: promo?.code ?? null,
    freeDeliveryRemaining: freeDeliveryRemaining(goodsValue),
  };
}

/** Пустая корзина. Отдельная функция, чтобы UI не собирал нули руками. */
export function emptyCartTotals(): CartTotals {
  return cartTotals({ lines: [] });
}

/**
 * Приветственный промокод из конфигурации в виде, пригодном для расчёта.
 * Нужен сиду и демо-режиму: код объявлен один раз в `promotions.welcomeCode`.
 */
export function welcomePromo(): AppliedPromo {
  return {
    code: promotions.welcomeCode.code,
    percentOff: promotions.welcomeCode.percentOff,
  };
}

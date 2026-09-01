/**
 * MONEY — целочисленная арифметика денег.
 *
 * Почему не `number` напрямую: драм целочисленный, но комиссии, НДС и скидки
 * дают дроби. Округление «где придётся» приводит к расхождению суммы позиций
 * и итога заказа на 1–2 ֏ — и к спорам с эквайрером. Здесь округление
 * происходит в одном месте и всегда одинаково.
 */

import { commission, currency, tax } from '@/config/business';
import type { LineItemType } from '@/config/pricing';
import { commissionableLineItems } from '@/config/pricing';

/** Сумма в минимальных единицах валюты. Для AMD это целые драмы. */
export type Money = number;

export class MoneyError extends Error {
  constructor(message: string) {
    super(`[money] ${message}`);
    this.name = 'MoneyError';
  }
}

function assertValid(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new MoneyError(`${label} не является числом: ${value}`);
  if (!Number.isInteger(value)) throw new MoneyError(`${label} должно быть целым: ${value}`);
}

export function money(value: number): Money {
  assertValid(value, 'Сумма');
  return value;
}

export function add(...values: Money[]): Money {
  return values.reduce((acc, v) => acc + money(v), 0);
}

export function subtract(a: Money, b: Money): Money {
  return money(a) - money(b);
}

export function multiply(amount: Money, quantity: number): Money {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new MoneyError(`Количество должно быть целым неотрицательным: ${quantity}`);
  }
  return money(amount) * quantity;
}

/** Половина вверх — совпадает с поведением большинства эквайреров. */
export function applyRate(amount: Money, rate: number): Money {
  if (rate < 0) throw new MoneyError(`Ставка не может быть отрицательной: ${rate}`);
  return Math.round(money(amount) * rate);
}

/** Округление до шага прайс-листа (по умолчанию 100 ֏). */
export function roundToPriceStep(amount: Money, step: number = currency.roundingStep): Money {
  if (step <= 0) return money(amount);
  return Math.round(money(amount) / step) * step;
}

export function clampNonNegative(amount: Money): Money {
  return Math.max(0, money(amount));
}

/* ─────────────────────────────── НДС ─────────────────────────────── */

export interface VatBreakdown {
  gross: Money;
  net: Money;
  vat: Money;
  rate: number;
}

/**
 * Разложение цены на нетто и НДС.
 * `pricesIncludeVat = true` (норма для b2c РА) → НДС извлекается из цены,
 * иначе начисляется сверху.
 */
export function breakdownVat(
  amount: Money,
  rate: number = tax.vatRate,
  includesVat: boolean = tax.pricesIncludeVat,
): VatBreakdown {
  if (rate === 0) return { gross: money(amount), net: money(amount), vat: 0, rate };

  if (includesVat) {
    const net = Math.round(money(amount) / (1 + rate));
    return { gross: money(amount), net, vat: subtract(amount, net), rate };
  }
  const vat = applyRate(amount, rate);
  return { gross: add(amount, vat), net: money(amount), vat, rate };
}

/* ────────────────────────── Комиссия платформы ────────────────────────── */

export interface CommissionSplit {
  gross: Money;
  /** Комиссия платформы. */
  platformFee: Money;
  /** К выплате исполнителю. */
  providerNet: Money;
  rate: number;
}

export function commissionRateFor(itemType: LineItemType): number {
  switch (itemType) {
    case 'CLASS_BOOKING':
    case 'PRIVATE_SESSION':
    case 'COURSE_ENROLLMENT':
      return commission.instructorRate;
    case 'STUDIO_RENTAL':
      return commission.venueRate;
    case 'EVENT_TICKET':
      return commission.eventRate;
    case 'PRODUCT':
      return commission.ownProductRate;
    default:
      return 0;
  }
}

export function splitCommission(amount: Money, itemType: LineItemType): CommissionSplit {
  if (!commissionableLineItems.includes(itemType)) {
    return { gross: money(amount), platformFee: 0, providerNet: money(amount), rate: 0 };
  }
  const rate = commissionRateFor(itemType);
  const raw = applyRate(amount, rate);
  const platformFee = Math.min(Math.max(raw, commission.minimumFee), money(amount));
  return {
    gross: money(amount),
    platformFee,
    providerNet: subtract(amount, platformFee),
    rate,
  };
}

/* ───────────────────── Пропорциональное распределение ───────────────────── */

/**
 * Распределяет сумму (например, скидку на заказ) по позициям пропорционально
 * их стоимости, гарантируя, что сумма частей равна исходной сумме:
 * остаток от округления добавляется к самой крупной позиции.
 */
export function distributeProportionally(total: Money, weights: readonly Money[]): Money[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return weights.map(() => 0);

  const parts = weights.map((w) => Math.floor((money(total) * w) / totalWeight));
  let remainder = money(total) - parts.reduce((a, b) => a + b, 0);

  const order = weights
    .map((w, i) => ({ w, i }))
    .sort((a, b) => b.w - a.w)
    .map((x) => x.i);

  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    const index = order[cursor % order.length];
    if (index !== undefined) {
      parts[index] = (parts[index] ?? 0) + 1;
      remainder -= 1;
    }
    cursor += 1;
  }
  return parts;
}

/* ──────────────────────────── Форматирование ──────────────────────────── */

/**
 * Форматирование НЕ дублирует `Intl` из next-intl — оно нужно там, где нет
 * контекста React (письма, PDF, логи). В UI используйте
 * `useFormatter().number(value, 'price')`.
 */
export function formatMoney(amount: Money, locale: string, currencyCode = currency.code): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: currency.decimals,
  }).format(money(amount));
}

/** Строка для платёжного провайдера: целое число без разделителей. */
export function toProviderAmount(amount: Money): string {
  return String(money(amount));
}

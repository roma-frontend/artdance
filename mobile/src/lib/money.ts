/**
 * Целочисленная арифметика денег для отображения в приложении.
 *
 * Перенесено из веба (`src/domain/money.ts`) без правил, которые принимает сервер:
 * комиссии, выплаты и минимальные сборы здесь не считаются. Ставки и шаг округления
 * передаются параметрами, поэтому модуль не зависит от конфигов веба.
 *
 * Драм целочисленный, а НДС и скидки дают дроби. Округление делается в одном месте
 * и всегда одинаково, иначе сумма позиций расходится с итогом на 1–2 ֏.
 */

export class MoneyError extends Error {
  constructor(message: string) {
    super(`[money] ${message}`);
    this.name = 'MoneyError';
  }
}

function assertInteger(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new MoneyError(`${label} не является числом: ${value}`);
  if (!Number.isInteger(value)) throw new MoneyError(`${label} должно быть целым: ${value}`);
}

/** Половина вверх — как у большинства эквайреров. */
export function applyRate(amount: number, rate: number): number {
  assertInteger(amount, 'Сумма');
  if (rate < 0) throw new MoneyError(`Ставка не может быть отрицательной: ${rate}`);
  return Math.round(amount * rate);
}

/** Округление до шага прайс-листа, по умолчанию 100 ֏. */
export function roundToPriceStep(amount: number, step = 100): number {
  assertInteger(amount, 'Сумма');
  if (step <= 0) return amount;
  return Math.round(amount / step) * step;
}

export interface VatBreakdown {
  gross: number;
  net: number;
  vat: number;
}

/**
 * Разложение цены на нетто и НДС.
 * `includesVat = true` — НДС извлекается из цены; иначе начисляется сверху.
 */
export function breakdownVat(amount: number, rate: number, includesVat: boolean): VatBreakdown {
  assertInteger(amount, 'Сумма');
  if (rate === 0) return { gross: amount, net: amount, vat: 0 };

  if (includesVat) {
    const net = Math.round(amount / (1 + rate));
    return { gross: amount, net, vat: amount - net };
  }
  const vat = applyRate(amount, rate);
  return { gross: amount + vat, net: amount, vat };
}

/**
 * Распределяет сумму (например, скидку на заказ) по позициям пропорционально их
 * стоимости. Сумма частей всегда равна исходной: остаток от округления уходит
 * самой крупной позиции.
 */
export function distributeProportionally(total: number, weights: readonly number[]): number[] {
  assertInteger(total, 'Сумма');
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return weights.map(() => 0);

  const parts = weights.map((w) => Math.floor((total * w) / totalWeight));
  let remainder = total - parts.reduce((a, b) => a + b, 0);

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

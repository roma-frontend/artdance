/**
 * DYNAMIC PRICING (B-09) — снимок цены на hold→CONFIRMED.
 * Вечер/выходные — коэффициент, пиковая надбавка капается 1.6x, скидка пола не ниже 0.7x.
 */

export function priceForSlot(basePrice: number, opts: { isPeak: boolean; isWeekend: boolean }): number {
  let multiplier = 1;
  if (opts.isPeak) multiplier *= 1.2;
  if (opts.isWeekend) multiplier *= 1.1;
  const floored = Math.max(0.7, Math.min(1.6, multiplier));
  return Math.round(basePrice * floored);
}

export function isPeakHour(hour: number): boolean {
  return hour >= 18 && hour <= 21;
}

export function isWeekendDay(day: number): boolean {
  return day === 0 || day === 6;
}

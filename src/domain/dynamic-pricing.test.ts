import { describe, expect, it } from 'vitest';

import { isPeakHour, isWeekendDay, priceForSlot } from './dynamic-pricing';

describe('dynamic-pricing', () => {
  it('B-10: peak evening 1.2x', () => {
    expect(priceForSlot(10_000, { isPeak: true, isWeekend: false })).toBe(12_000);
  });

  it('B-10: weekend 1.1x', () => {
    expect(priceForSlot(10_000, { isPeak: false, isWeekend: true })).toBe(11_000);
  });

  it('B-10: peak+weekend 1.32x', () => {
    expect(priceForSlot(10_000, { isPeak: true, isWeekend: true })).toBe(13_200);
  });

  it('B-10: flat when neither', () => {
    expect(priceForSlot(10_000, { isPeak: false, isWeekend: false })).toBe(10_000);
  });

  it('B-10: clamps 0.7–1.6', () => {
    expect(priceForSlot(10_000, { isPeak: true, isWeekend: true })).toBeLessThanOrEqual(16_000);
    expect(priceForSlot(10_000, { isPeak: false, isWeekend: false })).toBeGreaterThanOrEqual(7000);
  });

  it('B-10: rounds', () => {
    expect(priceForSlot(3333, { isPeak: true, isWeekend: false })).toBe(4000);
  });

  it('B-10: isPeakHour 18–21 inclusive', () => {
    expect(isPeakHour(17)).toBe(false);
    expect(isPeakHour(18)).toBe(true);
    expect(isPeakHour(21)).toBe(true);
    expect(isPeakHour(22)).toBe(false);
  });

  it('B-10: isWeekendDay 0,6', () => {
    expect(isWeekendDay(0)).toBe(true);
    expect(isWeekendDay(6)).toBe(true);
    expect(isWeekendDay(1)).toBe(false);
    expect(isWeekendDay(5)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { apertureFlare, apertureOpen } from './aperture';

describe('Раскрытие киноэкрана', () => {
  it('закрыт, пока панель ниже окна, и открыт, когда поднялась на весь ход', () => {
    expect(apertureOpen(1000, 1000, 0.8)).toBe(0);
    expect(apertureOpen(1400, 1000, 0.8)).toBe(0);
    expect(apertureOpen(200, 1000, 0.8)).toBe(1);
    expect(apertureOpen(-500, 1000, 0.8)).toBe(1);
  });

  it('в середине хода раскрыт наполовину и растёт монотонно', () => {
    expect(apertureOpen(600, 1000, 0.8)).toBeCloseTo(0.5);
    expect(apertureOpen(800, 1000, 0.8)).toBeLessThan(apertureOpen(700, 1000, 0.8));
  });

  it('не делит на ноль', () => {
    expect(apertureOpen(500, 0, 0.8)).toBe(1);
  });
});

describe('Блик раскрытия', () => {
  it('виден только на середине хода', () => {
    expect(apertureFlare(0)).toBe(0);
    expect(apertureFlare(1)).toBe(0);
    expect(apertureFlare(0.5)).toBe(1);
  });
});

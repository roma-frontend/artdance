import { describe, expect, it } from 'vitest';

import { stackCover } from './stack';

describe('Накрытие карточки стопки', () => {
  it('равно нулю, пока следующая карточка ниже нижней кромки', () => {
    expect(stackCover(100, 400, 500)).toBe(0);
    expect(stackCover(100, 400, 900)).toBe(0);
  });

  it('растёт по мере наезда и доходит до единицы на месте прилипания', () => {
    expect(stackCover(100, 400, 300)).toBeCloseTo(0.5);
    expect(stackCover(100, 400, 100)).toBe(1);
    expect(stackCover(100, 400, 128, 28)).toBe(1);
    expect(stackCover(100, 400, 314, 28)).toBeCloseTo(0.5);
  });

  it('не выходит за 0…1 и не делит на ноль', () => {
    expect(stackCover(100, 400, 50)).toBe(1);
    expect(stackCover(100, 20, 110, 28)).toBe(0);
  });
});

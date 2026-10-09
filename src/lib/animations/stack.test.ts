import { describe, expect, it } from 'vitest';

import { paintStackCover, stackCover } from './stack';

describe('Накрытие карточки стопки', () => {
  it('читает всю геометрию до записи и не перезаписывает неизменившееся накрытие', () => {
    const operations: string[] = [];
    const values = [new Map<string, string>(), new Map<string, string>()];
    const items = [100, 300].map((top, index) => ({
      getBoundingClientRect: () => { operations.push('read'); return { top }; },
      get offsetHeight() { operations.push('read'); return 400; },
      style: {
        getPropertyValue: (key: string) => values[index]!.get(key) ?? '',
        setProperty: (key: string, value: string) => { operations.push('write'); values[index]!.set(key, value); },
      },
    })) as unknown as HTMLElement[];
    paintStackCover(items);
    expect(operations).toEqual(['read', 'read', 'read', 'read', 'write', 'write']);
    expect(values[0]!.get('--stack-cover')).toBe('0.500');
    expect(values[1]!.get('--stack-cover')).toBe('0.000');
    operations.length = 0;
    paintStackCover(items);
    expect(operations).toEqual(['read', 'read', 'read', 'read']);
  });
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

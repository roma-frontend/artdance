import { describe, expect, it } from 'vitest';

import { collaborativeCandidates } from '@/domain/recommendations';

const SEED = 'seed';

describe('collaborativeCandidates', () => {
  it('без заказов с товаром совместных покупок нет', () => {
    const lines = [{ orderId: 'o1', productId: 'b' }];

    expect(collaborativeCandidates(lines, new Set(), SEED)).toEqual([]);
  });

  it('считает заказы, а не строки: три строки одного товара в одном заказе дают один голос', () => {
    const lines = [
      { orderId: 'o1', productId: 'b' },
      { orderId: 'o1', productId: 'b' },
      { orderId: 'o1', productId: 'b' },
      { orderId: 'o2', productId: 'c' },
      { orderId: 'o3', productId: 'c' },
    ];

    expect(collaborativeCandidates(lines, new Set(['o1', 'o2', 'o3']), SEED)).toEqual(['c', 'b']);
  });

  it('исключает сам товар и строки заказов, где его не покупали', () => {
    const lines = [
      { orderId: 'o1', productId: SEED },
      { orderId: 'o1', productId: 'b' },
      { orderId: 'o9', productId: 'd' },
    ];

    expect(collaborativeCandidates(lines, new Set(['o1']), SEED)).toEqual(['b']);
  });

  it('при равном счёте порядок задаёт id, чтобы выдача не менялась от запуска к запуску', () => {
    const lines = [
      { orderId: 'o1', productId: 'x' },
      { orderId: 'o1', productId: 'a' },
    ];

    expect(collaborativeCandidates(lines, new Set(['o1']), SEED)).toEqual(['a', 'x']);
  });
});

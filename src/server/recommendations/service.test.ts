import { beforeEach, describe, expect, it, vi } from 'vitest';

import { limits } from '@/config/business';
import { productRecommendations } from '@/server/recommendations/service';

const h = vi.hoisted(() => ({
  product: { findFirst: vi.fn(), findMany: vi.fn() },
  orderItem: { findMany: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ db: h }));
vi.mock('@/server/query', () => ({
  defineQuery: (config: { handler: unknown }) => config.handler,
}));
vi.mock('@/server/queries/products', () => ({
  productSelect: { title: true },
  publicProductWhere: { isActive: true },
  toProductCard: (row: { slug: string }) => ({ slug: row.slug }),
}));

const BOUGHT_STATUSES = ['PAID', 'PACKING', 'SHIPPED', 'DELIVERED'];

function line(orderId: string, productId: string | null) {
  return { orderId, variant: productId === null ? null : { productId } };
}

beforeEach(() => {
  vi.resetAllMocks();
  h.product.findFirst.mockResolvedValue({ id: 'seed' });
  h.product.findMany.mockResolvedValue([]);
});

describe('productRecommendations', () => {
  it('скрытый или несуществующий товар: пусто, заказы не читаются', async () => {
    h.product.findFirst.mockResolvedValue(null);

    await expect(productRecommendations('hidden-slug')).resolves.toEqual([]);
    expect(h.orderItem.findMany).not.toHaveBeenCalled();
  });

  it('ищет только публичный товар по slug', async () => {
    h.orderItem.findMany.mockResolvedValueOnce([]);

    await productRecommendations('seed-slug');

    expect(h.product.findFirst).toHaveBeenCalledWith({
      where: { slug: 'seed-slug', isActive: true, deletedAt: null },
      select: { id: true },
    });
  });

  it('сигнал берётся только из оплаченных заказов: отмена и неоплаченный заказ не учитываются', async () => {
    h.orderItem.findMany.mockResolvedValueOnce([]);

    await productRecommendations('seed-slug');

    expect(h.orderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { variant: { productId: 'seed' }, order: { status: { in: BOUGHT_STATUSES } } },
      }),
    );
  });

  it('нет заказов с товаром: пусто, кандидаты не читаются', async () => {
    h.orderItem.findMany.mockResolvedValueOnce([]);

    await expect(productRecommendations('seed-slug')).resolves.toEqual([]);
    expect(h.product.findMany).not.toHaveBeenCalled();
  });

  it('ранжирует по числу заказов и отдаёт карточки в этом порядке', async () => {
    h.orderItem.findMany
      .mockResolvedValueOnce([{ orderId: 'o1' }, { orderId: 'o2' }])
      .mockResolvedValueOnce([
        line('o1', 'seed'),
        line('o1', 'b'),
        line('o2', 'seed'),
        line('o2', 'b'),
        line('o2', 'c'),
        line('o2', null),
      ]);
    h.product.findMany.mockResolvedValue([
      { id: 'c', slug: 'c-slug' },
      { id: 'b', slug: 'b-slug' },
    ]);

    await expect(productRecommendations('seed-slug')).resolves.toEqual([
      { slug: 'b-slug' },
      { slug: 'c-slug' },
    ]);
    expect(h.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['b', 'c'] }, isActive: true, deletedAt: null },
      }),
    );
  });

  it('скрытый товар выпадает, а его место занимает следующий', async () => {
    h.orderItem.findMany
      .mockResolvedValueOnce([{ orderId: 'o1' }])
      .mockResolvedValueOnce([line('o1', 'seed'), line('o1', 'b'), line('o1', 'c')]);
    h.product.findMany.mockResolvedValue([{ id: 'c', slug: 'c-slug' }]);

    await expect(productRecommendations('seed-slug')).resolves.toEqual([{ slug: 'c-slug' }]);
  });

  it('не отдаёт больше лимита блока', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    h.orderItem.findMany
      .mockResolvedValueOnce([{ orderId: 'o1' }])
      .mockResolvedValueOnce([line('o1', 'seed'), ...ids.map((id) => line('o1', id))]);
    h.product.findMany.mockResolvedValue(ids.map((id) => ({ id, slug: `${id}-slug` })));

    const result = await productRecommendations('seed-slug');

    expect(result).toHaveLength(limits.recommendations.shop);
  });
});

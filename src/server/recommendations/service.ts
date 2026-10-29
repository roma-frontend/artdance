import 'server-only';

import type { OrderStatus } from '@/generated/prisma/client';
import { limits } from '@/config/business';
import { cacheTags, dataRevalidate } from '@/config/cache';
import type { ProductCardItem } from '@/domain/content';
import { collaborativeCandidates } from '@/domain/recommendations';
import { notTrashed } from '@/domain/trash';
import { db } from '@/lib/db';
import { defineQuery } from '@/server/query';
import { productSelect, publicProductWhere, toProductCard } from '@/server/queries/products';

/**
 * Статусы, при которых товар считается купленным. Отмена и неоплаченный заказ
 * сигналом не служат: иначе в блоке оказались бы товары, которые никто не брал.
 */
const BOUGHT_STATUSES: OrderStatus[] = ['PAID', 'PACKING', 'SHIPPED', 'DELIVERED'];

/**
 * «Часто покупают вместе»: публичные товары из тех же заказов, что и товар страницы.
 *
 * Похожие по категории отдаёт `related` на странице товара (SQL-фильтр и предел),
 * поэтому здесь только совместные покупки: два блока не повторяют друг друга.
 * Выборка ограничена `limits.recommendations`, чтобы страница товара не зависела
 * от размера истории заказов.
 */
export const productRecommendations = defineQuery({
  name: 'productRecommendations',
  tags: (slug: string) => [cacheTags.product(slug), cacheTags.products()],
  revalidate: dataRevalidate.entity,
  handler: async (slug: string): Promise<readonly ProductCardItem[]> => {
    const seed = await db.product.findFirst({
      where: { slug, ...publicProductWhere, ...notTrashed },
      select: { id: true },
    });
    if (!seed) return [];

    const seedLines = await db.orderItem.findMany({
      where: { variant: { productId: seed.id }, order: { status: { in: BOUGHT_STATUSES } } },
      select: { orderId: true },
      orderBy: { order: { placedAt: 'desc' } },
      take: limits.recommendations.seedOrders,
    });
    const seedOrderIds = [...new Set(seedLines.map((line) => line.orderId))];
    if (seedOrderIds.length === 0) return [];

    const lines = await db.orderItem.findMany({
      where: { orderId: { in: seedOrderIds } },
      select: { orderId: true, variant: { select: { productId: true } } },
      take: limits.recommendations.lines,
    });
    const pairs = lines.flatMap((line) =>
      line.variant ? [{ orderId: line.orderId, productId: line.variant.productId }] : [],
    );
    const ranked = collaborativeCandidates(pairs, new Set(seedOrderIds), seed.id).slice(
      0,
      limits.recommendations.candidates,
    );
    if (ranked.length === 0) return [];

    // Публичность проверяем после ранжирования: скрытый товар выпадает, и его место занимает следующий.
    const rows = await db.product.findMany({
      where: { id: { in: ranked }, ...publicProductWhere, ...notTrashed },
      select: { id: true, ...productSelect },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ranked
      .flatMap((id) => {
        const row = byId.get(id);
        return row ? [toProductCard(row)] : [];
      })
      .slice(0, limits.recommendations.shop);
  },
});

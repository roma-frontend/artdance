/**
 * RECOMMENDATIONS (C-06) — правила рекомендаций.
 * «Похожие товары» (та же категория) отдаёт запрос `related` на странице товара: он уже
 * фильтрует категорию в SQL с пределом. Здесь только «часто покупают вместе» по OrderItem.
 */

/**
 * Совместные покупки seed-товара: товары из тех же заказов, от частых к редким.
 *
 * `seedOrderIds` — заказы, где купили этот товар. `lines` — строки заказов с уже
 * развёрнутым `productId` (из варианта), включая строки самого seed-товара.
 * Считаем заказы, а не строки: два размера одного товара в одном заказе — одна покупка.
 * При равном счёте порядок задаёт id, чтобы выдача не менялась от запуска к запуску.
 */
export function collaborativeCandidates(
  lines: readonly { orderId: string; productId: string }[],
  seedOrderIds: ReadonlySet<string>,
  seedProductId: string,
): string[] {
  const ordersByProduct = new Map<string, Set<string>>();
  for (const line of lines) {
    if (line.productId === seedProductId || !seedOrderIds.has(line.orderId)) continue;
    const orders = ordersByProduct.get(line.productId) ?? new Set<string>();
    orders.add(line.orderId);
    ordersByProduct.set(line.productId, orders);
  }
  return [...ordersByProduct.entries()]
    .map(([productId, orders]) => ({ productId, count: orders.size }))
    .sort((a, b) => b.count - a.count || a.productId.localeCompare(b.productId))
    .map((entry) => entry.productId);
}

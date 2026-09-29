/**
 * RECOMMENDATIONS (C-06) — правила рекомендаций.
 * «Похожие товары» — та же категория, «часто бронируют вместе» — коллаборативная по OrderItem.
 */

export function similarByCategory(currentCategoryId: string | null, candidates: { id: string; categoryId: string | null }[]): string[] {
  if (!currentCategoryId) return [];
  return candidates.filter((c) => c.categoryId === currentCategoryId).map((c) => c.id);
}

export function collaborativeCandidates(orderItems: { orderId: string; productId: string }[], seedProductId: string): string[] {
  const orderIds = orderItems.filter((i) => i.productId === seedProductId).map((i) => i.orderId);
  if (orderIds.length === 0) return [];
  const counts = new Map<string, number>();
  for (const item of orderItems) {
    if (item.productId === seedProductId) continue;
    if (!orderIds.includes(item.orderId)) continue;
    counts.set(item.productId, (counts.get(item.productId) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

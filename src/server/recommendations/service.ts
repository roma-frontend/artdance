import 'server-only';

import { db } from '@/lib/db';
import { similarByCategory, collaborativeCandidates } from '@/domain/recommendations';

export async function productRecommendations(productId: string, _viewerId?: string | null) {
  const product = await db.product.findUnique({ where: { id: productId }, select: { categoryId: true } });
  if (!product) return [];
  const catId = (product as unknown as { categoryId: string | null }).categoryId;
  const candidates = await db.product.findMany({ where: { id: { not: productId }, isActive: true, deletedAt: null }, select: { id: true, categoryId: true }, take: 20 });
  const sameCategory = similarByCategory(catId, candidates as unknown as { id: string; categoryId: string | null }[]);
  if (sameCategory.length >= 4) return sameCategory.slice(0, 8);
  // collaborative fallback
  const orderItems = await db.orderItem.findMany({ select: { orderId: true, variantId: true }, take: 500 } as never);
  // map variant -> product via ProductVariant
  const variantToProduct = new Map<string, string>();
  const variants = await db.productVariant.findMany({ select: { id: true, productId: true } });
  for (const v of variants) variantToProduct.set((v as unknown as { id: string }).id, (v as unknown as { productId: string }).productId);
  const items = (orderItems as unknown as { orderId: string; variantId: string | null }[]).filter((i) => i.variantId).map((i) => ({ orderId: i.orderId, productId: variantToProduct.get(i.variantId!) ?? i.variantId! }));
  const collab = collaborativeCandidates(items, productId);
  return [...new Set([...sameCategory, ...collab])].slice(0, 8);
}

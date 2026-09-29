/**
 * CART ABANDONMENT (C-04) — брошенная корзина.
 * Корзина получает expiresAt при добавлении товара; просроченная — чистится cron'ом с напоминанием.
 */

export function cartAbandoned(cart: { expiresAt: Date | null; updatedAt: Date }, now: Date): boolean {
  return cart.expiresAt !== null && cart.expiresAt.getTime() <= now.getTime();
}

export function cartExpiresAt(now: Date, hours = 24): Date {
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

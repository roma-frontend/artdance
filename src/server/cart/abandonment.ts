import 'server-only';

import { db } from '@/lib/db';
import { notify } from '@/lib/notifications/send';
import { cartAbandoned } from '@/domain/cart-abandonment';

export async function findAbandonedCarts(now: Date) {
  const carts = await db.cart.findMany({ where: { expiresAt: { lte: now } } as never, select: { id: true, userId: true, expiresAt: true, updatedAt: true } });
  return carts.filter((c) => cartAbandoned(c as unknown as { expiresAt: Date | null; updatedAt: Date }, now));
}

export async function remindAbandonedCart(cartId: string) {
  const cart = await db.cart.findUnique({ where: { id: cartId }, select: { userId: true, items: { select: { id: true } } } });
  if (!cart || !(cart as unknown as { userId: string | null }).userId) return;
  const userId = (cart as unknown as { userId: string }).userId;
  const user = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
  const locale = ((user as unknown as { locale: string } | null)?.locale as never) ?? 'ru';
  await notify({ userId, type: 'cart.abandoned', locale, data: {}, dedupeKey: `cart:${cartId}:abandoned`, href: `/${locale}/cart` } as never);
}

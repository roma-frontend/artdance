/**
 * CART ABANDONMENT (C-04) — письмо о брошенной корзине.
 *
 * Корзина получает `expiresAt` при добавлении товара (+24 ч). Когда срок вышел, а в корзине
 * остались товары, уходит одно письмо. Пустые и анонимные корзины письма не получают.
 * Пользователь получает не больше одного такого письма за `REMINDER_WINDOW_MS`: уже
 * напомненные корзины выпадают из выборки, поэтому тик не перебирает одни и те же строки.
 */

import 'server-only';

import { routes } from '@/config/routes';
import { absoluteUrl } from '@/config/site';
import { cartAbandoned } from '@/domain/cart-abandonment';
import { db } from '@/lib/db';
import { notify } from '@/lib/notifications/send';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Просроченная корзина старше этого окна уже не напоминается: письмо опоздало бы. */
const REMINDER_WINDOW_MS = 3 * DAY_MS;
/** Не больше стольких корзин за тик; остальные уйдут на следующих тиках. */
const ABANDONED_CART_BATCH_SIZE = 100;

/**
 * Просроченные корзины с товарами, по которым письмо ещё не уходило в окне. Анонимные
 * корзины и пользователи, которые неактивны или удаляют аккаунт, сюда не попадают.
 */
export async function findAbandonedCarts(now: Date) {
  const since = new Date(now.getTime() - REMINDER_WINDOW_MS);
  const carts = await db.cart.findMany({
    where: {
      userId: { not: null },
      expiresAt: { gte: since, lte: now },
      items: { some: {} },
      user: {
        isActive: true,
        deletionRequestedAt: null,
        anonymizedAt: null,
        notifications: { none: { type: 'cart.abandoned', createdAt: { gte: since } } },
      },
    },
    orderBy: { expiresAt: 'desc' },
    take: ABANDONED_CART_BATCH_SIZE,
    select: { id: true, userId: true, expiresAt: true, updatedAt: true },
  });
  return carts.filter((cart) => cartAbandoned(cart, now));
}

/**
 * Ставит письмо о брошенной корзине. true — письмо поставлено в очередь. false — корзина
 * пустая или анонимная, либо письмо по ней уже было (`notify` не ставит повтор).
 */
export async function remindAbandonedCart(cartId: string): Promise<boolean> {
  const cart = await db.cart.findUnique({
    where: { id: cartId },
    select: {
      userId: true,
      user: { select: { locale: true } },
      items: { select: { id: true }, take: 1 },
    },
  });
  if (!cart?.userId || !cart.user || cart.items.length === 0) return false;

  const { locale } = cart.user;
  return notify({
    userId: cart.userId,
    type: 'cart.abandoned',
    locale,
    data: {},
    dedupeKey: `cart:${cartId}:abandoned`,
    href: absoluteUrl(`/${locale}${routes.cart()}`),
  });
}

/**
 * Отправляет напоминания по подходящим корзинам тика. Сбой одной корзины логируется и не
 * останавливает остальные. Возвращает число корзин, по которым письмо поставлено в очередь.
 */
export async function sendAbandonedCartReminders(now: Date): Promise<number> {
  const carts = await findAbandonedCarts(now);
  let queued = 0;
  for (const cart of carts) {
    try {
      if (await remindAbandonedCart(cart.id)) queued += 1;
    } catch (error) {
      console.error('[cron:abandoned-carts]', error);
    }
  }
  return queued;
}

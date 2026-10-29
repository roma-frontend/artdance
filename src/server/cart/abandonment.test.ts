import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findAbandonedCarts, remindAbandonedCart, sendAbandonedCartReminders } from '@/server/cart/abandonment';

const h = vi.hoisted(() => ({
  db: {
    cart: { findMany: vi.fn(), findUnique: vi.fn() },
  },
  notify: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: h.db }));
vi.mock('@/lib/notifications/send', () => ({ notify: h.notify }));

const NOW = new Date('2026-03-10T12:00:00.000Z');
const WINDOW_START = new Date('2026-03-07T12:00:00.000Z');

/** Просроченная корзина в том виде, в каком её отдаёт выборка findMany. */
function expiredCart(id: string, expiresAt = new Date('2026-03-10T10:00:00.000Z')) {
  return { id, userId: 'user-1', expiresAt, updatedAt: new Date('2026-03-09T10:00:00.000Z') };
}

/** Корзина в том виде, в каком её отдаёт findUnique внутри remindAbandonedCart. */
function loadedCart({
  userId = 'user-1',
  items = 1,
  locale = 'ru',
}: { userId?: string | null; items?: number; locale?: 'hy' | 'ru' | 'en' } = {}) {
  return {
    userId,
    user: userId === null ? null : { locale },
    items: Array.from({ length: items }, (_, index) => ({ id: `item-${index}` })),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  h.notify.mockResolvedValue(true);
});

describe('findAbandonedCarts', () => {
  it('ищет корзины с товарами у активных пользователей без письма за последние три дня', async () => {
    h.db.cart.findMany.mockResolvedValue([]);

    await findAbandonedCarts(NOW);

    expect(h.db.cart.findMany).toHaveBeenCalledWith({
      where: {
        userId: { not: null },
        expiresAt: { gte: WINDOW_START, lte: NOW },
        items: { some: {} },
        user: {
          isActive: true,
          deletionRequestedAt: null,
          anonymizedAt: null,
          notifications: { none: { type: 'cart.abandoned', createdAt: { gte: WINDOW_START } } },
        },
      },
      orderBy: { expiresAt: 'desc' },
      take: 100,
      select: { id: true, userId: true, expiresAt: true, updatedAt: true },
    });
  });

  it('отбрасывает корзину, срок которой ещё не вышел', async () => {
    h.db.cart.findMany.mockResolvedValue([
      expiredCart('cart-1'),
      expiredCart('cart-2', new Date('2026-03-10T13:00:00.000Z')),
    ]);

    const carts = await findAbandonedCarts(NOW);

    expect(carts.map((cart) => cart.id)).toEqual(['cart-1']);
  });
});

describe('remindAbandonedCart', () => {
  it('ставит письмо в локали пользователя со ссылкой на корзину', async () => {
    h.db.cart.findUnique.mockResolvedValue(loadedCart({ locale: 'en' }));

    const queued = await remindAbandonedCart('cart-1');

    expect(queued).toBe(true);
    expect(h.notify).toHaveBeenCalledWith({
      userId: 'user-1',
      type: 'cart.abandoned',
      locale: 'en',
      data: {},
      dedupeKey: 'cart:cart-1:abandoned',
      href: 'http://localhost:3000/en/cart',
    });
  });

  it('пустая корзина письма не получает', async () => {
    h.db.cart.findUnique.mockResolvedValue(loadedCart({ items: 0 }));

    expect(await remindAbandonedCart('cart-1')).toBe(false);
    expect(h.notify).not.toHaveBeenCalled();
  });

  it('анонимная корзина письма не получает', async () => {
    h.db.cart.findUnique.mockResolvedValue(loadedCart({ userId: null }));

    expect(await remindAbandonedCart('cart-1')).toBe(false);
    expect(h.notify).not.toHaveBeenCalled();
  });

  it('возвращает false, когда notify не поставил письмо', async () => {
    h.db.cart.findUnique.mockResolvedValue(loadedCart());
    h.notify.mockResolvedValue(false);

    expect(await remindAbandonedCart('cart-1')).toBe(false);
  });
});

describe('sendAbandonedCartReminders', () => {
  it('считает поставленные письма и не останавливается на сбое одной корзины', async () => {
    h.db.cart.findMany.mockResolvedValue([expiredCart('cart-1'), expiredCart('cart-2'), expiredCart('cart-3')]);
    h.db.cart.findUnique
      .mockRejectedValueOnce(new Error('db timeout'))
      .mockResolvedValueOnce(loadedCart({ items: 0 }))
      .mockResolvedValueOnce(loadedCart());
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const queued = await sendAbandonedCartReminders(NOW);

    expect(queued).toBe(1);
    expect(h.notify).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[cron:abandoned-carts]', expect.any(Error));
  });
});

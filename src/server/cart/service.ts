/**
 * CART SERVICE — серверный слепок корзины.
 *
 * Клиент рисует корзину из локального состояния (zustand), а
 * этот модуль — источник истины:
 *   - цена берётся из ProductVariant.price в момент проверки;
 *   - остаток — stock - reserved;
 *   - промокод валидируется по БД (validateCart);
 *   - гость (anonymousId) переносится в Cart пользователя при входе.
 *
 * Хранение: Cart (userId XOR anonymousId) + CartItem[], без expiresAt.
 */

import 'server-only';

import { commerce, promotions } from '@/config/business';
import { domainErrors } from '@/domain/errors';
import { cartTotals, clampQuantity, type CartLine, type CartTotals } from '@/domain/cart';
import { db } from '@/lib/db';

// ── Типы ───────────────────────────────────────────────────────────────

export interface CartItemInput {
  variantId: string;
  quantity: number;
}

export interface CartSnapshot {
  cartId: string;
  owner: { userId: string | null; anonymousId: string | null };
  items: readonly {
    id: string;
    variantId: string | null;
    quantity: number;
    unitPrice: number;
    sku: string | null;
    title: string;
    slug: string | null;
    image: { key: string; alt: { hy: string; ru: string; en: string }; width?: number; height?: number; blurDataUrl?: string; focalPoint?: string } | null;
    brand: string | null;
    stock: number; // available = stock - reserved
    isActive: boolean;
  }[];
  promoCode: string | null;
  totals: CartTotals;
  issues: readonly CartIssue[];
}

export type CartIssue =
  | { type: 'priceChanged'; variantId: string; from: number; to: number }
  | { type: 'outOfStock'; variantId: string }
  | { type: 'quantityClamped'; variantId: string; requested: number; allowed: number }
  | { type: 'promoInvalid'; reason: string };

interface ResolvedCart {
  id: string;
  userId: string | null;
  anonymousId: string | null;
  promoCodeId: string | null;
}

// ── Внутренние хелперы ───────────────────────────────────────────────

async function getOrCreateCart(params: {
  userId?: string | null;
  anonymousId?: string | null;
}): Promise<ResolvedCart> {
  const { userId, anonymousId } = params;
  if (!userId && !anonymousId) throw domainErrors.unauthorized();

  const where = userId ? { userId } : { anonymousId: anonymousId! };
  let cart = (await db.cart.findUnique({ where })) as unknown as ResolvedCart | null;
  if (cart) return cart;

  // create — может гонка, ловим unique violation
  try {
    cart = (await db.cart.create({
      data: {
        ...(userId ? { userId } : { anonymousId: anonymousId! }),
        currencyCode: 'AMD',
      },
      select: { id: true, userId: true, anonymousId: true, promoCodeId: true },
    })) as unknown as ResolvedCart;
    return cart;
  } catch {
    // другой запрос создал — перечитаем
    cart = (await db.cart.findUnique({ where })) as unknown as ResolvedCart | null;
    if (cart) return cart;
    throw domainErrors.validationFailed('cart');
  }
}

async function buildSnapshot(cart: ResolvedCart): Promise<CartSnapshot> {
  const items = (await db.cartItem.findMany({
    where: { cartId: cart.id },
    include: {
      variant: {
        select: {
          sku: true,
          price: true,
          stock: true,
          reserved: true,
          isActive: true,
          product: {
            select: {
              title: true,
              brand: true,
              slug: true,
              media: { select: { storageKey: true, width: true, height: true, blurDataUrl: true, focalPoint: true, translations: { select: { locale: true, altText: true } } }, where: { productId: { not: undefined } } as never, orderBy: { sortOrder: 'asc' } as never, take: 1 },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })) as unknown as Array<{
    id: string;
    variantId: string | null;
    quantity: number;
    unitPrice: number;
    variant: {
      sku: string;
      price: number;
      stock: number;
      reserved: number;
      isActive: boolean;
      product: { title: string; brand: string | null; slug: string; media: Array<{ storageKey: string; width: number; height: number; blurDataUrl: string; translations: Array<{ locale: string; altText: string }> }> } | null;
    } | null;
  }>;

  const promoRow = cart.promoCodeId
    ? await db.promoCode.findUnique({ where: { id: cart.promoCodeId }, select: { code: true } })
    : null;

  const lines: CartLine[] = [];
  const issues: CartIssue[] = [];
  const mutableItems: Array<CartSnapshot['items'][number]> = [];

  for (const item of items) {
    const v = item.variant;
    const available = v ? Math.max(0, v.stock - v.reserved) : 0;

    const media = v?.product?.media?.[0] as unknown as { storageKey: string; width: number | null; height: number | null; blurDataUrl: string | null; focalPoint: string | null; translations: Array<{ locale: string; altText: string }> } | undefined;
    const baseKey = media ? media.storageKey.split('#')[0]! : null;
    // storageKey — ключ в R2 или путь в /media; не семантическое имя сид-ассета — Media резолвит его как путь/URL.
    const title = v?.product?.title ?? '';
    const image = baseKey
      ? {
          key: baseKey,
          alt: {
            hy: media!.translations.find((tr) => tr.locale === 'hy')?.altText ?? title,
            ru: media!.translations.find((tr) => tr.locale === 'ru')?.altText ?? title,
            en: media!.translations.find((tr) => tr.locale === 'en')?.altText ?? title,
          },
          ...(media!.width != null ? { width: media!.width } : {}),
          ...(media!.height != null ? { height: media!.height } : {}),
          ...(media!.blurDataUrl ? { blurDataUrl: media!.blurDataUrl } : {}),
          ...(media!.focalPoint ? { focalPoint: media!.focalPoint } : {}),
        }
      : null;
    mutableItems.push({
      id: item.id,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      sku: v?.sku ?? null,
      title: v?.product?.title ?? '—',
      slug: v?.product?.slug ?? null,
      image,
      brand: v?.product?.brand ?? null,
      stock: available,
      isActive: v?.isActive ?? false,
    });

    if (!v || !v.isActive) {
      issues.push({ type: 'outOfStock', variantId: item.variantId ?? item.id });
      continue;
    }
    if (available <= 0 && !commerce.allowBackorder) {
      issues.push({ type: 'outOfStock', variantId: item.variantId! });
      continue;
    }
    const clamped = available > 0 ? Math.min(item.quantity, available) : item.quantity;
    if (clamped !== item.quantity) {
      issues.push({ type: 'quantityClamped', variantId: item.variantId!, requested: item.quantity, allowed: clamped });
    }
    if (item.unitPrice !== v.price) {
      issues.push({ type: 'priceChanged', variantId: item.variantId!, from: item.unitPrice, to: v.price });
    }
    lines.push({ id: item.id, lineType: 'PRODUCT', unitPrice: v.price, quantity: clamped });
  }

  // Промокод → AppliedPromo: процент / фикс
  let promo: { code: string; percentOff?: number; amountOff?: number } | null = null;
  if (promoRow && cart.promoCodeId) {
    const pr = await db.promoCode.findUnique({ where: { id: cart.promoCodeId } });
    if (pr && pr.isActive && (!pr.endsAt || pr.endsAt.getTime() > Date.now()) && (!pr.startsAt || pr.startsAt.getTime() <= Date.now())) {
      if (pr.type === 'PERCENT') promo = { code: pr.code, percentOff: pr.value };
      else promo = { code: pr.code, amountOff: pr.value };
    } else {
      issues.push({ type: 'promoInvalid', reason: 'EXPIRED' });
    }
  }

  const totals = cartTotals({
    lines,
    promo: promo ? (promo as unknown as { code: string; percentOff?: number }) : null,
    deliveryZone: null,
  });

  // Если promoInvalid — total уже без промо в totals, но подсказка наружу нужна.
  return {
    cartId: cart.id,
    owner: { userId: cart.userId, anonymousId: cart.anonymousId },
    items: mutableItems as unknown as CartSnapshot['items'],
    promoCode: promo?.code ?? null,
    totals,
    issues,
  };
}

// ── Публичный API ─────────────────────────────────────────────────────

/** Серверный слепок. Создаёт корзину, если её нет. */
export async function getCartSnapshot(params: {
  userId?: string | null;
  anonymousId?: string | null;
}): Promise<CartSnapshot> {
  const cart = await getOrCreateCart(params);
  return buildSnapshot(cart);
}

/** Добавить позицию. Цена берётся из БД, количество — с clamp. */
export async function addCartItem(params: {
  userId?: string | null;
  anonymousId?: string | null;
  variantId: string;
  quantity?: number;
}): Promise<CartSnapshot> {
  const qty = clampQuantity(params.quantity ?? 1);
  const cart = await getOrCreateCart({ userId: params.userId, anonymousId: params.anonymousId });

  // Лимит позиций
  const count = await db.cartItem.count({ where: { cartId: cart.id } });
  const existing = await db.cartItem.findFirst({ where: { cartId: cart.id, variantId: params.variantId } });
  if (!existing && count >= commerce.maxCartItems) throw domainErrors.validationFailed('cart');

  const variant = await db.productVariant.findUnique({
    where: { id: params.variantId },
    select: { price: true, stock: true, reserved: true, isActive: true, deletedAt: true },
  });
  if (!variant || variant.deletedAt || !variant.isActive) throw domainErrors.notFound();
  const available = Math.max(0, variant.stock - variant.reserved);
  if (available <= 0 && !commerce.allowBackorder) throw domainErrors.validationFailed('stock');
  const requestedTotal = existing ? existing.quantity + qty : qty;
  const allowedTotal = available > 0 ? Math.min(requestedTotal, available) : requestedTotal;
  const toAdd = allowedTotal - (existing?.quantity ?? 0);
  if (toAdd <= 0) throw domainErrors.validationFailed('stock');

  if (existing) {
    await db.cartItem.update({ where: { id: existing.id }, data: { quantity: allowedTotal, unitPrice: variant.price } });
  } else {
    await db.cartItem.create({
      data: { cartId: cart.id, type: 'PRODUCT', variantId: params.variantId, quantity: toAdd, unitPrice: variant.price },
    });
  }

  return getCartSnapshot({ userId: params.userId, anonymousId: params.anonymousId });
}

export async function updateCartItem(params: {
  userId?: string | null;
  anonymousId?: string | null;
  itemId: string;
  quantity: number;
}): Promise<CartSnapshot> {
  const cart = await getOrCreateCart({ userId: params.userId, anonymousId: params.anonymousId });
  const item = await db.cartItem.findUnique({ where: { id: params.itemId } });
  if (!item || item.cartId !== cart.id) throw domainErrors.notFound();
  const qty = clampQuantity(params.quantity);
  const variant = item.variantId
    ? await db.productVariant.findUnique({ where: { id: item.variantId }, select: { stock: true, reserved: true, price: true } })
    : null;
  const available = variant ? Math.max(0, variant.stock - variant.reserved) : qty;
  const allowed = available > 0 ? Math.min(qty, available) : qty;
  await db.cartItem.update({ where: { id: params.itemId }, data: { quantity: allowed, ...(variant ? { unitPrice: variant.price } : {}) } });
  return buildSnapshot(cart);
}

export async function removeCartItem(params: {
  userId?: string | null;
  anonymousId?: string | null;
  itemId: string;
}): Promise<CartSnapshot> {
  const cart = await getOrCreateCart({ userId: params.userId, anonymousId: params.anonymousId });
  const item = await db.cartItem.findUnique({ where: { id: params.itemId } });
  if (!item || item.cartId !== cart.id) throw domainErrors.notFound();
  await db.cartItem.delete({ where: { id: params.itemId } });
  return buildSnapshot(cart);
}

export async function clearCart(params: {
  userId?: string | null;
  anonymousId?: string | null;
}): Promise<CartSnapshot> {
  const cart = await getOrCreateCart(params);
  await db.cartItem.deleteMany({ where: { cartId: cart.id } });
  return buildSnapshot({ ...cart });
}

/**
 * validateCart — пересчёт по БД, diff для экрана.
 *
 * - Подменяет unitPrice на текущий price;
 * - Клипает количество под available;
 * - Удаляет деактивированные варианты;
 * - Проверяет промокод по БД и инвалидирует истёкший.
 * Возвращает слепок + issues; запись применяется в БД, чтобы
 * следующий checkout увидел исправленные значения.
 */
export async function validateCart(params: {
  userId?: string | null;
  anonymousId?: string | null;
}): Promise<CartSnapshot> {
  const cart = await getOrCreateCart(params);
  const items = await db.cartItem.findMany({ where: { cartId: cart.id } });

  for (const item of items) {
    if (!item.variantId) continue;
    const v = await db.productVariant.findUnique({
      where: { id: item.variantId },
      select: { price: true, stock: true, reserved: true, isActive: true, deletedAt: true },
    });
    if (!v || v.deletedAt || !v.isActive) {
      await db.cartItem.delete({ where: { id: item.id } });
      continue;
    }
    const available = Math.max(0, v.stock - v.reserved);
    if (available <= 0 && !commerce.allowBackorder) {
      await db.cartItem.delete({ where: { id: item.id } });
      continue;
    }
    const allowed = available > 0 ? Math.min(item.quantity, available) : item.quantity;
    const needsFix = item.unitPrice !== v.price || allowed !== item.quantity;
    if (needsFix) {
      await db.cartItem.update({ where: { id: item.id }, data: { unitPrice: v.price, quantity: allowed } });
    }
  }

  if (cart.promoCodeId) {
    const pr = await db.promoCode.findUnique({ where: { id: cart.promoCodeId } });
    const invalid = !pr || !pr.isActive || (pr.endsAt && pr.endsAt.getTime() <= Date.now()) || (pr.startsAt && pr.startsAt.getTime() > Date.now());
    if (invalid) {
      await db.cart.update({ where: { id: cart.id }, data: { promoCodeId: null } });
      cart.promoCodeId = null;
    }
  }

  return buildSnapshot(cart);
}

/** Применить промокод (по коду строки). Проверяет активность/сроки/лимиты. */
export async function applyPromoCode(params: {
  userId?: string | null;
  anonymousId?: string | null;
  code: string;
}): Promise<CartSnapshot> {
  const code = params.code.trim().toUpperCase();
  if (code.length < promotions.codeMinLength || code.length > promotions.codeMaxLength) throw domainErrors.validationFailed('promoCode');
  const pr = await db.promoCode.findUnique({ where: { code } });
  if (!pr || !pr.isActive) throw domainErrors.validationFailed('promoCode');
  if (pr.deletedAt) throw domainErrors.validationFailed('promoCode');
  if (pr.startsAt && pr.startsAt.getTime() > Date.now()) throw domainErrors.validationFailed('promoCode');
  if (pr.endsAt && pr.endsAt.getTime() <= Date.now()) throw domainErrors.validationFailed('promoCode');
  if (pr.usageLimit !== null && pr.usageCount >= pr.usageLimit) throw domainErrors.validationFailed('promoCode');
  // perUserLimit — проверяем заказы пользователя
  if (params.userId && pr.perUserLimit !== null) {
    const used = await db.order.count({ where: { userId: params.userId, promoCodeId: pr.id } });
    if (used >= pr.perUserLimit) throw domainErrors.validationFailed('promoCode');
  }
  const cart = await getOrCreateCart({ userId: params.userId, anonymousId: params.anonymousId });
  await db.cart.update({ where: { id: cart.id }, data: { promoCodeId: pr.id } });
  return getCartSnapshot({ userId: params.userId, anonymousId: params.anonymousId });
}

export async function removePromoCode(params: {
  userId?: string | null;
  anonymousId?: string | null;
}): Promise<CartSnapshot> {
  const cart = await getOrCreateCart(params);
  await db.cart.update({ where: { id: cart.id }, data: { promoCodeId: null } });
  return getCartSnapshot({ userId: params.userId, anonymousId: params.anonymousId });
}

/**
 * Мерж гость → пользователь при входе.
 * Корзина гостя (anonymousId) вливается в корзину пользователя (userId).
 * Конфликт variantId: количества складываются с clamp по available.
 * Промокод гостя переносится, если у пользователя пусто.
 */
export async function mergeGuestCart(params: { userId: string; anonymousId: string }): Promise<CartSnapshot> {
  const { userId, anonymousId } = params;
  if (!userId || !anonymousId) throw domainErrors.validationFailed('merge');

  const guest = (await db.cart.findUnique({ where: { anonymousId } })) as unknown as ResolvedCart | null;
  if (!guest) return getCartSnapshot({ userId });

  const userCart = await getOrCreateCart({ userId });
  if (guest.id === userCart.id) return buildSnapshot(userCart);

  const guestItems = await db.cartItem.findMany({ where: { cartId: guest.id } });

  for (const gi of guestItems) {
    if (!gi.variantId) continue;
    const existing = await db.cartItem.findFirst({ where: { cartId: userCart.id, variantId: gi.variantId } });
    const v = await db.productVariant.findUnique({ where: { id: gi.variantId }, select: { price: true, stock: true, reserved: true, isActive: true, deletedAt: true } });
    if (!v || v.deletedAt || !v.isActive) continue;
    const available = Math.max(0, v.stock - v.reserved);
    if (available <= 0 && !commerce.allowBackorder) continue;
    if (existing) {
      const sum = existing.quantity + gi.quantity;
      const allowed = available > 0 ? Math.min(sum, available) : sum;
      await db.cartItem.update({ where: { id: existing.id }, data: { quantity: allowed, unitPrice: v.price } });
      await db.cartItem.delete({ where: { id: gi.id } });
    } else {
      const allowed = available > 0 ? Math.min(gi.quantity, available) : gi.quantity;
      await db.cartItem.update({ where: { id: gi.id }, data: { cartId: userCart.id, quantity: allowed, unitPrice: v.price } });
    }
  }

  // Промокод
  if (!userCart.promoCodeId && guest.promoCodeId) {
    await db.cart.update({ where: { id: userCart.id }, data: { promoCodeId: guest.promoCodeId } });
  }

  // Гостевую корзину удаляем, если пуста
  const left = await db.cartItem.count({ where: { cartId: guest.id } });
  if (left === 0) await db.cart.delete({ where: { id: guest.id } });

  return validateCart({ userId });
}

// ── Счётчик для шапки ────────────────────────────────────────────────

export async function cartItemCountForHeader(params: {
  userId?: string | null;
  anonymousId?: string | null;
}): Promise<number> {
  const where = params.userId ? { userId: params.userId } : params.anonymousId ? { anonymousId: params.anonymousId } : null;
  if (!where) return 0;
  const cart = (await db.cart.findUnique({ where, select: { id: true } })) as unknown as { id: string } | null;
  if (!cart) return 0;
  const items = await db.cartItem.findMany({ where: { cartId: cart.id }, select: { quantity: true } });
  return items.reduce((s: number, r: { quantity: number }) => s + r.quantity, 0);
}

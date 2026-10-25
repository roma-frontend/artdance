/**
 * ORDERS SERVICE — 4.5/4.6/4.7/4.8/4.9
 *
 * - 4.5 Заказ: пересчёт итогов на сервере, НДС, доставка.
 * - 4.6 Промокоды: атомарное применение (usageCount в транзакции).
 * - 4.7 Склад: списание stock/reserved, reserved для неоплаченных — через cart.
 * - 4.8 Статусы: единый переходник, идемпотентность по orderNumber/status.
 * - 4.9 Подарочные карты: создание GiftCard из OrderItem GIFT_CARD.
 */

import 'server-only';

import { commerce, promotions, tax } from '@/config/business';
import { domainErrors } from '@/domain/errors';
import { cartTotals, type CartLine, type DeliveryZone } from '@/domain/cart';
import type { LineItemType, OrderStatus } from '@/generated/prisma/client';
import { db } from '@/lib/db';

function orderNumber(): string {
  const prefix = commerce.orderNumberPrefix;
  const len = commerce.orderNumberLength;
  const rand = Math.random().toString(36).slice(2, 2 + len).toUpperCase().padEnd(len, 'X').slice(0, len);
  return `${prefix}${rand}`;
}

/** Адрес, введённый в оформлении. Снимок, а не ссылка на адресную книгу. */
export interface OrderAddressSnapshot {
  street: string;
  city: string;
  postalCode?: string | null;
}

export interface CreateOrderInput {
  userId?: string | null;
  anonymousId?: string | null; // для гостя — создаём Order без userId, свяжем при входе отдельно
  contactEmail: string;
  contactPhone: string;
  contactName: string;
  deliveryMethod?: 'COURIER' | 'PICKUP_POINT' | null;
  deliveryAddressId?: string | null;
  deliveryAddress?: OrderAddressSnapshot | null;
  deliveryNotes?: string | null;
  pickupPointCode?: string | null;
}

export async function createOrder(input: CreateOrderInput) {
  // Серверная валидация контактных данных (клиент может обойти checkout-screen)
  const normalizedEmail = input.contactEmail.trim().toLowerCase();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail) && normalizedEmail.length <= 254;
  if (!emailOk) throw domainErrors.validationFailed('contactEmail');
  const phoneDigits = input.contactPhone.replace(/\D/g, '');
  if (phoneDigits.length < 6 || phoneDigits.length > 20) throw domainErrors.validationFailed('contactPhone');
  const nameTrimmed = input.contactName.trim();
  if (nameTrimmed.length < 1 || nameTrimmed.length > 80) throw domainErrors.validationFailed('contactName');
  if (/[<>]/.test(nameTrimmed)) throw domainErrors.validationFailed('contactName');
  if (input.deliveryAddressId) {
    const addr = await db.address.findUnique({ where: { id: input.deliveryAddressId }, select: { userId: true } });
    if (!addr) throw domainErrors.validationFailed('deliveryAddressId');
    if (input.userId && addr.userId !== input.userId) throw domainErrors.forbidden();
    if (!input.userId && addr.userId) throw domainErrors.forbidden();
  }
  if (input.deliveryNotes && input.deliveryNotes.length > 500) throw domainErrors.validationFailed('deliveryNotes');
  /*
   * Курьеру адрес обязателен, а пункту выдачи — нет. Проверка здесь, а не в
   * форме: действие вызывается напрямую, и «адрес не пришёл» должно стать
   * отказом с кодом, а не заказом, который некуда везти.
   */
  if (input.deliveryMethod === 'COURIER') {
    const street = input.deliveryAddress?.street?.trim() ?? '';
    const city = input.deliveryAddress?.city?.trim() ?? '';
    if (!street || !city) throw domainErrors.validationFailed('deliveryAddress');
    if (street.length > 200 || city.length > 120) throw domainErrors.validationFailed('deliveryAddress');
  }
  // Корзину пересчитываем по БД (validateCart-логика кусочно)
  const where = input.userId ? { userId: input.userId } : input.anonymousId ? { anonymousId: input.anonymousId } : null;
  if (!where) throw domainErrors.unauthorized();
  const cart = (await db.cart.findUnique({ where, include: { items: { include: { variant: true } } } })) as unknown as {
    id: string;
    promoCodeId: string | null;
    items: Array<{ id: string; variantId: string | null; quantity: number; unitPrice: number; type: string; variant: { sku: string; price: number; stock: number; reserved: number; isActive: boolean; deletedAt: Date | null; product: { title: string } } | null }>;
  } | null;
  if (!cart || cart.items.length === 0) throw domainErrors.validationFailed('cart');

  // promo
  let promo: { code: string; percentOff?: number; amountOff?: number } | null = null;
  if (cart.promoCodeId) {
    const pr = await db.promoCode.findUnique({ where: { id: cart.promoCodeId } });
    if (pr && pr.isActive && !pr.deletedAt && (!pr.endsAt || pr.endsAt.getTime() > Date.now())) {
      if (pr.type === 'PERCENT') promo = { code: pr.code, percentOff: pr.value };
      else promo = { code: pr.code, amountOff: pr.value };
    }
  }

  // Линии для cartTotals
  const activeItems = cart.items.filter((it) => it.variant && it.variant.isActive && !it.variant.deletedAt);
  if (activeItems.length === 0) throw domainErrors.validationFailed('cart');

  const lines: CartLine[] = activeItems.map((it) => ({
    id: it.id,
    lineType: 'PRODUCT',
    unitPrice: it.variant!.price,
    quantity: it.quantity,
  }));

  // Доставка: выводим зону из метода
  const deliveryZone = input.deliveryMethod === 'PICKUP_POINT' ? 'pickup' : input.deliveryMethod === 'COURIER' ? 'yerevan' : null;

  const totals = cartTotals({ lines, promo: promo as unknown as { code: string; percentOff?: number } | null, deliveryZone: deliveryZone as unknown as DeliveryZone | null });

  // Транзакция: создать Order + OrderItem + инкремент usageCount + списание stock (4.7)
  const created = await db.$transaction(async (tx) => {
    // Позиции корзины забираются первым шагом: повторная отправка ждёт блокировку и не создаёт второй заказ.
    const claimedItems = await tx.cartItem.deleteMany({ where: { cartId: cart.id, id: { in: activeItems.map((it) => it.id) } } });
    if (claimedItems.count !== activeItems.length) throw domainErrors.validationFailed('cart');

    // Промокод — атомарно: только если usageCount < usageLimit
    if (promo && cart.promoCodeId) {
      const pr = await tx.promoCode.findUnique({ where: { id: cart.promoCodeId } });
      if (!pr) throw domainErrors.validationFailed('promoCode');
      if (pr.usageLimit !== null && pr.usageCount >= pr.usageLimit) throw domainErrors.validationFailed('promoCode');
      if (pr.usageLimit !== null) {
        const bumped = await tx.promoCode.updateMany({
          where: { id: cart.promoCodeId, usageCount: { lt: pr.usageLimit } },
          data: { usageCount: { increment: 1 } },
        });
        if (bumped.count !== 1) throw domainErrors.validationFailed('promoCode');
      } else {
        await tx.promoCode.update({ where: { id: cart.promoCodeId }, data: { usageCount: { increment: 1 } } });
      }
      // perUserLimit — проверяем внутри транзакции
      if (pr.perUserLimit !== null && input.userId) {
        const used = await tx.order.count({ where: { userId: input.userId, promoCodeId: pr.id } });
        if (used >= pr.perUserLimit) throw domainErrors.validationFailed('promoCode');
      }
    }

    const num = orderNumber();
    const order = await tx.order.create({
      data: {
        orderNumber: num,
        userId: input.userId ?? null,
        /* Гость оплачивает тем же ключом, что и корзину — см. `payments/service`. */
        anonymousId: input.userId ? null : (input.anonymousId ?? null),
        status: 'CREATED',
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        contactName: input.contactName,
        deliveryMethod: input.deliveryMethod ?? null,
        deliveryAddressId: input.deliveryAddressId ?? null,
        ...(input.deliveryAddress ? { deliveryAddressSnapshot: input.deliveryAddress as never } : {}),
        deliveryNotes: input.deliveryNotes ?? null,
        pickupPointCode: input.pickupPointCode ?? null,
        subtotal: totals.subtotal,
        discountTotal: totals.discount,
        deliveryFee: totals.deliveryFee,
        vatAmount: totals.vat,
        total: totals.total,
        currencyCode: 'AMD',
        promoCodeId: cart.promoCodeId ?? null,
        vatRate: tax.vatRate,
        pricesIncludeVat: tax.pricesIncludeVat,
      },
      select: { id: true, orderNumber: true, total: true, vatAmount: true },
    });

    for (const it of activeItems) {
      const lineTotal = it.variant!.price * it.quantity;
      // доля скидки (пропорционально, упрощённо round)
      const share = totals.discount > 0 && totals.subtotal > 0 ? Math.round((lineTotal / totals.subtotal) * totals.discount) : 0;
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          type: it.type as unknown as LineItemType,
          titleSnapshot: it.variant!.product?.title ?? it.variant!.sku,
          variantId: it.variantId ?? null,
          quantity: it.quantity,
          unitPrice: it.variant!.price,
          discountAmount: share,
          lineTotal: lineTotal - share,
        },
      });

      // Склад: атомарно — декремент только если осталось достаточно (защита от гонки)
      if (!commerce.allowBackorder) {
        const claimed = await tx.productVariant.updateMany({
          where: { id: it.variantId!, stock: { gte: it.quantity } },
          data: { stock: { decrement: it.quantity } },
        });
        if (claimed.count !== 1) throw domainErrors.validationFailed('stock');
      } else {
        await tx.productVariant.update({
          where: { id: it.variantId! },
          data: { stock: { decrement: it.quantity } },
        });
      }

    }

    // GiftCards: для каждой OrderItem с продуктом из giftCardCategory — выпускаем карты
    const cat = await tx.productCategory.findUnique({ where: { slug: commerce.giftCardCategorySlug }, select: { id: true } });
    if (cat) {
      for (const it of activeItems) {
        const v = await tx.productVariant.findUnique({ where: { id: it.variantId! }, select: { productId: true } });
        if (!v) continue;
        const p = await tx.product.findUnique({ where: { id: v.productId }, select: { categoryId: true } });
        if (p?.categoryId === cat.id) {
          for (let i = 0; i < it.quantity; i += 1) {
            const code = `GC-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
            await tx.giftCard.create({
              data: {
                code,
                purchaserId: input.userId ?? null,
                orderId: order.id,
                initialAmount: it.variant!.price,
                balance: it.variant!.price,
                currencyCode: 'AMD',
                expiresAt: new Date(Date.now() + promotions.giftCard.validityMonths * 30 * 24 * 60 * 60 * 1000),
              },
            });
          }
        }
      }
    }

    // Очищаем корзину
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    await tx.cart.update({ where: { id: cart.id }, data: { promoCodeId: null } });

    return order;
  });

  return created;
}

/* ──────────── Заказы, которые не собираются из корзины ──────────── */

export interface DirectOrderLine {
  type: LineItemType;
  title: string;
  unitPrice: number;
  quantity?: number;
  /** Служебные поля для доставки после оплаты: `passId`, `planId`, сумма пополнения. */
  metadata?: Record<string, string | number>;
}

export interface CreateDirectOrderInput {
  userId: string;
  contact: { email: string; phone: string; name: string };
  lines: readonly DirectOrderLine[];
}

export interface DirectOrderResult {
  id: string;
  orderNumber: string;
  total: number;
}

/**
 * Заказ из готовых позиций: пакет занятий, пополнение кошелька, подписка.
 *
 * Отдельная точка входа, а не корзина с фиктивным товаром: у этих покупок нет
 * склада, доставки и промокода, а писать их в `Cart` — провести клиента через
 * шаги, которые для него бессмысленны. Итоги считает тот же `cartTotals`, что и
 * магазин: НДС и округление не должны расходиться между двумя способами купить.
 */
export async function createDirectOrder(input: CreateDirectOrderInput): Promise<DirectOrderResult> {
  const email = input.contact.email.trim().toLowerCase();
  if (!/^[^\s@]+@\S+\.\S{2,}$/.test(email) || email.length > 254) {
    throw domainErrors.validationFailed('contactEmail');
  }
  /*
   * Телефон пакета/подписки необязателен: это цифровая покупка, её не везут
   * курьером, а требование номера в профиле не гарантировано. Пустая строка
   * пропускается; непустая — проверяется по тем же правилам, что и в магазине,
   * чтобы формат не разъезжался между двумя кассами.
   */
  const phoneTrace = input.contact.phone.trim();
  const phoneDigits = phoneTrace.replace(/\D/g, '');
  if (phoneTrace && (phoneDigits.length < 6 || phoneDigits.length > 20)) {
    throw domainErrors.validationFailed('contactPhone');
  }
  const name = input.contact.name.trim();
  if (name.length < 1 || name.length > 80 || /[<>]/.test(name)) throw domainErrors.validationFailed('contactName');

  if (input.lines.length === 0) throw domainErrors.validationFailed('lines');
  for (const line of input.lines) {
    if (!Number.isSafeInteger(line.unitPrice) || line.unitPrice <= 0) throw domainErrors.validationFailed('unitPrice');
    const quantity = line.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) throw domainErrors.validationFailed('quantity');
  }

  const lines: CartLine[] = input.lines.map((line, index) => ({
    id: `direct-${index}`,
    lineType: line.type,
    unitPrice: line.unitPrice,
    quantity: line.quantity ?? 1,
  }));
  const totals = cartTotals({ lines });

  return db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber: orderNumber(),
        userId: input.userId,
        status: 'CREATED',
        contactEmail: email,
        /* Пустой телефон хранится пустой строкой: колонка обязательная, а NULL в ней нет. */
        contactPhone: phoneTrace,
        contactName: name,
        subtotal: totals.subtotal,
        discountTotal: 0,
        deliveryFee: 0,
        vatAmount: totals.vat,
        total: totals.total,
        currencyCode: 'AMD',
        vatRate: tax.vatRate,
        pricesIncludeVat: tax.pricesIncludeVat,
      },
      select: { id: true, orderNumber: true, total: true },
    });

    for (const line of input.lines) {
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          type: line.type,
          titleSnapshot: line.title.slice(0, 200),
          quantity: line.quantity ?? 1,
          unitPrice: line.unitPrice,
          lineTotal: line.unitPrice * (line.quantity ?? 1),
          ...(line.metadata ? { metadata: line.metadata as never } : {}),
        },
      });
    }

    return order;
  });
}

/** 4.8 Единый переходник статусов, идемпотентность — повтор того же статуса = no-op */
const allowedTransitions: Record<string, readonly string[]> = {
  CREATED: ['PAID', 'CANCELLED'],
  PAID: ['PACKING', 'CANCELLED', 'RETURNED'],
  PACKING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  CANCELLED: [],
  RETURNED: [],
};

export async function transitionOrder(input: { orderId: string; to: string; actorId?: string }): Promise<{ id: string; status: string }> {
  const order = await db.order.findUnique({ where: { id: input.orderId }, select: { status: true } });
  if (!order) throw domainErrors.notFound();
  if (order.status === input.to) return { id: input.orderId, status: order.status };
  const allowed = allowedTransitions[order.status] ?? [];
  if (!allowed.includes(input.to)) throw domainErrors.validationFailed('status');

  const now = new Date();
  const patch: Record<string, Date | null> = {};
  if (input.to === 'PAID') patch.paidAt = now;
  else if (input.to === 'SHIPPED') patch.shippedAt = now;
  else if (input.to === 'DELIVERED') patch.deliveredAt = now;
  else if (input.to === 'CANCELLED') patch.cancelledAt = now;

  const updated = await db.order.update({ where: { id: input.orderId }, data: { status: input.to as unknown as OrderStatus, ...patch }, select: { id: true, status: true } });
  return updated as { id: string; status: string };
}

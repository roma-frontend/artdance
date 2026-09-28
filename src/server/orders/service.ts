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

export interface CreateOrderInput {
  userId?: string | null;
  anonymousId?: string | null; // для гостя — создаём Order без userId, свяжем при входе отдельно
  contactEmail: string;
  contactPhone: string;
  contactName: string;
  deliveryMethod?: 'COURIER' | 'PICKUP_POINT' | null;
  deliveryAddressId?: string | null;
  deliveryNotes?: string | null;
  pickupPointCode?: string | null;
}

export async function createOrder(input: CreateOrderInput) {
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
    // Промокод — атомарно инкремент usageCount, если есть
    if (promo && cart.promoCodeId) {
      const pr = await tx.promoCode.findUnique({ where: { id: cart.promoCodeId } });
      if (!pr) throw domainErrors.validationFailed('promoCode');
      if (pr.usageLimit !== null && pr.usageCount >= pr.usageLimit) throw domainErrors.validationFailed('promoCode');
      await tx.promoCode.update({ where: { id: cart.promoCodeId }, data: { usageCount: { increment: 1 } } });
    }

    const num = orderNumber();
    const order = await tx.order.create({
      data: {
        orderNumber: num,
        userId: input.userId ?? null,
        status: 'CREATED',
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        contactName: input.contactName,
        deliveryMethod: input.deliveryMethod ?? null,
        deliveryAddressId: input.deliveryAddressId ?? null,
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

      // Склад: списание stock (резерва при оплате нет — commerce.cartReservationMinutes=0)
      if (!commerce.allowBackorder) {
        // Проверяем доступность ещё раз внутри транзакции
        const fresh = await tx.productVariant.findUnique({ where: { id: it.variantId! }, select: { stock: true, reserved: true } });
        if (!fresh || fresh.stock - fresh.reserved < it.quantity) throw domainErrors.validationFailed('stock');
      }
      await tx.productVariant.update({
        where: { id: it.variantId! },
        data: { stock: { decrement: it.quantity } },
      });

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

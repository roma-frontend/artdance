import 'server-only';

import type { LineItemType } from '@/config/pricing';
import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { isFirstBooking } from '@/domain/first-booking';
import { add, applyRate, clampNonNegative, money } from '@/domain/money';

/** Клиент транзакции брони: проверка и списание идут в той же транзакции. */
type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export interface FirstBookingPromoInput {
  userId: string;
  /** Код как его ввёл клиент: пробелы убираем, регистр не важен. */
  promoCode: string;
  /** Цена урока на момент брони, уже с пиковой и выходной надбавкой. */
  lessonPrice: number;
  travelFee: number;
  lineType: LineItemType;
  now: Date;
  /** Транзакция брони. Без неё читаем обычным клиентом. */
  tx?: Tx;
}

export interface FirstBookingPromo {
  promoCodeId: string;
  discountAmount: number;
  /** null — лимита использований нет. */
  usageLimit: number | null;
}

/**
 * Проверяет промокод на первую бронь и считает скидку. Ничего не записывает.
 *
 * Процент берётся от цены урока без выезда, округляется как в корзине (`applyRate`),
 * ограничивается `maxDiscount`. Код, который покрывает всю бронь, отклоняется.
 */
export async function applyFirstBookingPromo(input: FirstBookingPromoInput): Promise<FirstBookingPromo> {
  const client: Tx = input.tx ?? db;
  const code = input.promoCode.trim().toUpperCase();
  const promo = await client.promoCode.findFirst({ where: { code, deletedAt: null } });
  // Код не найден или удалён: отвечаем как на неверный ввод, чтобы ответ не раскрывал, существует ли код.
  if (!promo) throw domainErrors.validationFailed('promoCode');
  if (!promo.isActive) throw domainErrors.validationFailed('promoCode');
  if (promo.startsAt && promo.startsAt.getTime() > input.now.getTime()) throw domainErrors.validationFailed('promoCode');
  if (promo.endsAt && promo.endsAt.getTime() <= input.now.getTime()) throw domainErrors.validationFailed('promoCode');
  if (!promo.appliesTo.includes(input.lineType)) throw domainErrors.validationFailed('promoCode');

  const subtotal = add(input.lessonPrice, input.travelFee);
  if (promo.minOrderTotal !== null && subtotal < promo.minOrderTotal) throw domainErrors.validationFailed('promoCode');

  // Первая бронь: у клиента не должно быть ни одной прежней брони, любого статуса.
  const previousBookings = await client.booking.count({ where: { customerId: input.userId } });
  if (!isFirstBooking(previousBookings)) throw domainErrors.validationFailed('promoCode');
  if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) throw domainErrors.validationFailed('promoCode');
  const usedByUser = await client.booking.count({ where: { customerId: input.userId, promoCodeId: promo.id } });
  if (usedByUser >= promo.perUserLimit) throw domainErrors.validationFailed('promoCode');

  const raw = clampNonNegative(promo.type === 'PERCENT' ? applyRate(input.lessonPrice, promo.value / 100) : money(promo.value));
  const discountAmount = promo.maxDiscount === null ? raw : Math.min(raw, promo.maxDiscount);
  // Оплата нулевой суммы в платёжном потоке не предусмотрена, поэтому такой код не применяем.
  if (discountAmount >= subtotal) throw domainErrors.validationFailed('promoCode');
  return { promoCodeId: promo.id, discountAmount, usageLimit: promo.usageLimit };
}

/**
 * Списывает одно использование в транзакции брони. С лимитом используется условный UPDATE:
 * два параллельных бронирования не займут последнее использование.
 */
export async function consumeFirstBookingPromo(tx: Tx, promo: FirstBookingPromo): Promise<void> {
  if (promo.usageLimit === null) {
    await tx.promoCode.update({ where: { id: promo.promoCodeId }, data: { usageCount: { increment: 1 } } });
    return;
  }
  const bumped = await tx.promoCode.updateMany({
    where: { id: promo.promoCodeId, usageCount: { lt: promo.usageLimit } },
    data: { usageCount: { increment: 1 } },
  });
  if (bumped.count !== 1) throw domainErrors.validationFailed('promoCode');
}

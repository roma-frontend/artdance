import 'server-only';

import { domainErrors } from '@/domain/errors';
import { classPassOfferPrice, passExpiresAt } from '@/domain/class-pass';
import { classPasses, priceGuidance } from '@/config/pricing';
import { db } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';

async function assertPackagesEnabled(): Promise<void> {
  await assertEntitlementOrThrow('packages');
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export interface PurchaseClassPassInput {
  userId: string;
  passId: string;
  idempotencyKey: string;
  now: Date;
  /**
   * Доставка уже оплаченного пакета (`payments/settle`).
   *
   * Тумблер решает, можно ли пакет КУПИТЬ, а не выдавать ли его за деньги,
   * которые уже взяты. Без этого выключение `packages` между оплатой и
   * подтверждением оставило бы заказ оплаченным и недоставленным — вечно,
   * потому что повторные попытки упирались бы в тот же отказ.
   */
  deliverOnly?: boolean;
}

export async function purchaseClassPass(input: PurchaseClassPassInput) {
  if (!input.deliverOnly) await assertPackagesEnabled();
  const offer = classPasses.find((pass) => pass.id === input.passId) ?? null;
  if (!offer) throw domainErrors.notFound();
  const pricePaid = classPassOfferPrice(priceGuidance.groupClass.typical, offer.discountRate, offer.lessons);
  const now = input.now;
  const existing = await db.classPass.findUnique({
    where: { purchaseKey: input.idempotencyKey },
    select: { id: true, expiresAt: true, lessonsRemaining: true, lessonsTotal: true },
  });
  if (existing) return existing;
  try {
    const expiresAt = passExpiresAt(now, offer.validityDays);
    const created = await db.classPass.create({
      data: {
        purchaserId: input.userId,
        purchaseKey: input.idempotencyKey,
        templateId: offer.id,
        lessonsTotal: offer.lessons,
        lessonsRemaining: offer.lessons,
        pricePaid,
        expiresAt,
      },
      select: { id: true, expiresAt: true, lessonsRemaining: true, lessonsTotal: true },
    });
    void pricePaid;
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      /*
       * Две параллельные отправки могут обе не увидеть запись в первом
       * findUnique. Уникальный ключ выигрывает гонку; возвращаем победившую
       * покупку вместо ошибки, чтобы повторная отправка оставалась безопасной.
       */
      const raced = await db.classPass.findUnique({
        where: { purchaseKey: input.idempotencyKey },
        select: { id: true, expiresAt: true, lessonsRemaining: true, lessonsTotal: true },
      });
      if (raced) return raced;
    }
    throw error;
  }
}

export interface RedeemClassPassInput {
  userId: string;
  passId: string;
  bookingId: string;
  now: Date;
}

export async function redeemClassPassForBooking(input: RedeemClassPassInput) {
  await assertPackagesEnabled();
  const result = await db.$transaction(async (tx) => {
    const pass = await tx.classPass.findUnique({ where: { id: input.passId } });
    if (!pass || pass.purchaserId !== input.userId) throw domainErrors.forbidden();
    if (pass.lessonsRemaining <= 0) throw domainErrors.validationFailed('classPass');
    if (pass.expiresAt.getTime() <= input.now.getTime()) throw domainErrors.validationFailed('classPass');

    const booking = await tx.booking.findUnique({ where: { id: input.bookingId }, select: { id: true, status: true, totalPrice: true, customerId: true, lessonType: true, startsAt: true, updatedAt: true, travelFee: true, payments: { where: { status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } }, select: { id: true } } } });
    if (!booking || booking.customerId !== input.userId) throw domainErrors.forbidden();
    if (booking.status !== 'CONFIRMED' || booking.lessonType !== 'GROUP' || booking.startsAt <= input.now || booking.payments.length > 0) throw domainErrors.validationFailed('bookingId');
    // Lock the booking before reading redemption: cancellation and another
    // redemption cannot both win against the same snapshot.
    const locked = await tx.booking.updateMany({
      where: { id: booking.id, status: 'CONFIRMED', updatedAt: booking.updatedAt },
      data: { updatedAt: new Date() },
    });
    if (locked.count !== 1) throw domainErrors.validationFailed('bookingId');

    const existing = await tx.classPassRedemption.findUnique({ where: { bookingId: booking.id } });
    if (existing) throw domainErrors.validationFailed('bookingId');

    const deducted = await tx.classPass.updateMany({
      where: { id: pass.id, purchaserId: input.userId, lessonsRemaining: { gt: 0 }, expiresAt: { gt: input.now } },
      data: { lessonsRemaining: { decrement: 1 } },
    });
    if (deducted.count !== 1) throw domainErrors.validationFailed('classPass');
    await tx.booking.update({ where: { id: booking.id }, data: { discountAmount: { increment: Math.max(0, booking.totalPrice - booking.travelFee) }, totalPrice: booking.travelFee } });
    return tx.classPassRedemption.create({ data: { passId: pass.id, bookingId: booking.id }, select: { id: true } });
  });
  return result;
}

import 'server-only';

import { domainErrors } from '@/domain/errors';
import { passExpiresAt } from '@/domain/class-pass';
import { booking } from '@/config/business';
import { classPasses } from '@/config/pricing';
import { db } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export interface PurchaseClassPassInput {
  userId: string;
  passId: string;
  idempotencyKey: string;
  now: Date;
}

export async function purchaseClassPass(input: PurchaseClassPassInput) {
  const offer = classPasses.find((pass) => pass.id === input.passId) ?? null;
  if (!offer) throw domainErrors.notFound();
  const pricePaid = Math.round(booking.travelFee === 5000 ? 0 : 0);
  // Стоимость пакета — из БД не берём: до договора R2/эквайринга продажа фиктивная (credit как в 07 B-03)
  // Источник правды цены — прайс группы, поэтому фиксируем на момент покупки снимок скидки
  const now = input.now;
  void input.idempotencyKey;
  try {
    const expiresAt = passExpiresAt(now, offer.validityDays);
    const created = await db.classPass.create({
      data: {
        purchaserId: input.userId,
        templateId: offer.id,
        lessonsTotal: offer.lessons,
        lessonsRemaining: offer.lessons,
        pricePaid: Math.round(0), // фактическая сумма из чекадо, до live-эквайринга — 0 (заглушка как в ui)
        expiresAt,
      },
      select: { id: true, expiresAt: true, lessonsRemaining: true, lessonsTotal: true },
    });
    void pricePaid;
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) throw domainErrors.validationFailed('classPass');
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
  const result = await db.$transaction(async (tx) => {
    const pass = await tx.classPass.findUnique({ where: { id: input.passId } });
    if (!pass || pass.purchaserId !== input.userId) throw domainErrors.forbidden();
    if (pass.lessonsRemaining <= 0) throw domainErrors.validationFailed('classPass');
    if (pass.expiresAt.getTime() <= input.now.getTime()) throw domainErrors.validationFailed('classPass');

    const booking = await tx.booking.findUnique({ where: { id: input.bookingId }, select: { id: true, status: true, totalPrice: true, customerId: true } });
    if (!booking || booking.customerId !== input.userId) throw domainErrors.forbidden();
    if (booking.status !== 'CONFIRMED') throw domainErrors.validationFailed('bookingId');

    const existing = await tx.classPassRedemption.findUnique({ where: { bookingId: booking.id } });
    if (existing) throw domainErrors.validationFailed('bookingId');

    await tx.classPass.update({ where: { id: pass.id }, data: { lessonsRemaining: { decrement: 1 } } });
    return tx.classPassRedemption.create({ data: { passId: pass.id, bookingId: booking.id }, select: { id: true } });
  });
  return result;
}

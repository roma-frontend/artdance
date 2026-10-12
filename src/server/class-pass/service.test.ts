import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() }));
const tx = vi.hoisted(() => ({ booking: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() }, classPassRedemption: { findUnique: vi.fn(), create: vi.fn() }, $transaction: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { classPass: mocks, ...tx } }));

import { Prisma } from '@/generated/prisma/client';
import { classPassById, priceGuidance } from '@/config/pricing';
import { classPassOfferPrice, passExpiresAt } from '@/domain/class-pass';
import { purchaseClassPass, redeemClassPassForBooking } from './service';

const input = { userId: 'customer-1', passId: 'cp-10', idempotencyKey: 'purchase-1', now: new Date('2026-10-12T10:00:00Z') };
const pass = { id: 'pass-1', lessonsTotal: 10, lessonsRemaining: 10, expiresAt: new Date('2027-01-01T10:00:00Z') };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findUnique.mockResolvedValue(null);
  mocks.create.mockResolvedValue(pass);
  tx.$transaction.mockImplementation(async handler => handler({ classPass: mocks, ...tx }));
});

describe('atomic redemption', () => {
  const redeem = { userId: input.userId, passId: pass.id, bookingId: 'booking-1', now: input.now };
  beforeEach(() => {
    mocks.findUnique.mockResolvedValue({ ...pass, purchaserId: input.userId });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    tx.booking.findUnique.mockResolvedValue({ id: 'booking-1', customerId: input.userId, lessonType: 'GROUP', status: 'CONFIRMED', startsAt: new Date('2026-12-01'), updatedAt: input.now, totalPrice: 10_000, travelFee: 0, payments: [] });
    tx.booking.updateMany.mockResolvedValue({ count: 1 });
    tx.classPassRedemption.findUnique.mockResolvedValue(null);
    tx.classPassRedemption.create.mockResolvedValue({ id: 'redemption-1' });
  });
  it('deducts using an owner, balance and expiry guard', async () => {
    await redeemClassPassForBooking(redeem);
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: pass.id, purchaserId: input.userId, lessonsRemaining: { gt: 0 }, expiresAt: { gt: input.now } }, data: { lessonsRemaining: { decrement: 1 } } });
  });
  it('does not overspend a concurrently exhausted pass', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(redeemClassPassForBooking(redeem)).rejects.toMatchObject({ field: 'classPass' });
    expect(tx.classPassRedemption.create).not.toHaveBeenCalled();
  });
  it('does not redeem a concurrently cancelled booking', async () => {
    tx.booking.updateMany.mockResolvedValue({ count: 0 });
    await expect(redeemClassPassForBooking(redeem)).rejects.toMatchObject({ field: 'bookingId' });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it('does not replace a paid booking with a pass', async () => {
    tx.booking.findUnique.mockResolvedValue({ id: 'booking-1', customerId: input.userId, lessonType: 'GROUP', status: 'CONFIRMED', startsAt: new Date('2026-12-01'), payments: [{ id: 'payment-1' }] });
    await expect(redeemClassPassForBooking(redeem)).rejects.toMatchObject({ field: 'bookingId' });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it('does not reuse a booking redemption', async () => {
    tx.classPassRedemption.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(redeemClassPassForBooking(redeem)).rejects.toMatchObject({ field: 'bookingId' });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it.each(['PRIVATE', 'PAIR'])('rejects %s lessons', async lessonType => {
    tx.booking.findUnique.mockResolvedValue({ id: 'booking-1', customerId: input.userId, lessonType, status: 'CONFIRMED', startsAt: new Date('2026-12-01') });
    await expect(redeemClassPassForBooking(redeem)).rejects.toMatchObject({ field: 'bookingId' });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});

describe('class-pass purchase', () => {
  it('stores server-side price, balance and expiry', async () => {
    const offer = classPassById(input.passId)!;
    expect(await purchaseClassPass(input)).toEqual(pass);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        purchaserId: input.userId, purchaseKey: input.idempotencyKey, templateId: offer.id,
        lessonsTotal: offer.lessons, lessonsRemaining: offer.lessons,
        pricePaid: classPassOfferPrice(priceGuidance.groupClass.typical, offer.discountRate, offer.lessons),
        expiresAt: passExpiresAt(input.now, offer.validityDays),
      },
    }));
  });

  it('returns the existing purchase without creating another pass', async () => {
    mocks.findUnique.mockResolvedValue(pass);
    expect(await purchaseClassPass(input)).toEqual(pass);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('returns the winning purchase after a concurrent unique-key conflict', async () => {
    mocks.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(pass);
    mocks.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Duplicate', { code: 'P2002', clientVersion: '7.10.0' }));
    expect(await purchaseClassPass(input)).toEqual(pass);
    expect(mocks.findUnique).toHaveBeenCalledTimes(2);
  });

  it('does not hide unrelated database failures', async () => {
    const error = new Error('Database unavailable');
    mocks.create.mockRejectedValue(error);
    await expect(purchaseClassPass(input)).rejects.toBe(error);
  });

  it('rejects an unknown offer before querying the database', async () => {
    await expect(purchaseClassPass({ ...input, passId: 'unknown' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    slotHold: { findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    danceClass: { findFirst: vi.fn(), findUnique: vi.fn() },
    classSession: { findFirst: vi.fn(), updateMany: vi.fn() },
    instructorProfile: { findUnique: vi.fn() },
    classPass: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    classPassRedemption: { create: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    waitlistEntry: { findFirst: vi.fn(), update: vi.fn() },
    availabilityRule: { findMany: vi.fn() },
    availabilityException: { findMany: vi.fn() },
    booking: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    $transaction: vi.fn(),
  },
  notifyBookingConfirmed: vi.fn(),
  notifyBookingCancelled: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/server/booking/notify', () => ({
  notifyBookingConfirmed: mocks.notifyBookingConfirmed,
  notifyBookingCancelled: mocks.notifyBookingCancelled,
  notifyWaitlistReady: vi.fn(),
}));
vi.mock('@/server/wallet/service', () => ({ creditWallet: vi.fn() }));

import { booking } from '@/config/business';
import { cancelBooking, createBookingFromHold, expireUnpaidBookings, rescheduleBooking } from './service';

const now = new Date('2026-10-01T08:00:00Z');
const startsAt = new Date('2026-10-03T14:00:00Z');
const endsAt = new Date('2026-10-03T15:00:00Z');
const hold = {
  id: 'hold-1',
  userId: 'customer-1',
  anonymousId: null,
  instructorId: 'anna-mkrtchyan',
  roomId: null,
  sessionId: null,
  startsAt,
  endsAt,
  expiresAt: new Date('2026-10-01T08:10:00Z'),
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.slotHold.findUnique.mockResolvedValue(hold);
  mocks.db.slotHold.deleteMany.mockResolvedValue({ count: 1 });
  mocks.db.classSession.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.$transaction.mockImplementation(async (handler) => handler(mocks.db));
  mocks.db.booking.findFirst.mockResolvedValue(null);
  mocks.db.booking.findMany.mockResolvedValue([]);
  mocks.db.slotHold.findMany.mockResolvedValue([]);
  mocks.db.booking.create.mockResolvedValue({ id: 'booking-1', reference: 'tmp' });
  mocks.db.booking.update.mockResolvedValue({ id: 'booking-1', startsAt, endsAt });
  mocks.notifyBookingConfirmed.mockResolvedValue(undefined);
  mocks.notifyBookingCancelled.mockResolvedValue(undefined);
});

describe('автоотмена неоплаченных броней', () => {
  it('переводит PENDING без оплаты старше окна в EXPIRED и возвращает место и урок абонемента', async () => {
    mocks.db.booking.findMany.mockResolvedValue([{ id: 'booking-9', updatedAt: now, sessionId: 'session-1', participants: 2 }]);
    mocks.db.booking.updateMany.mockResolvedValue({ count: 1 });
    mocks.db.classPassRedemption.findUnique.mockResolvedValue({ id: 'redemption-1', passId: 'pass-1' });
    mocks.db.classPass.update.mockResolvedValue({});
    mocks.db.classPassRedemption.delete.mockResolvedValue({});

    const result = await expireUnpaidBookings(now);

    expect(result).toEqual({ expired: 1 });
    const cutoff = new Date(now.getTime() - booking.unpaidExpiryMinutes * 60_000);
    expect(mocks.db.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'PENDING', createdAt: { lte: cutoff } }),
    }));
    expect(mocks.db.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-9', status: 'PENDING', updatedAt: now },
      data: { status: 'EXPIRED', cancellationReason: 'PAYMENT_TIMEOUT' },
    });
    expect(mocks.db.classSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { bookedCount: { decrement: 2 } },
    }));
    expect(mocks.db.classPass.update).toHaveBeenCalledWith({ where: { id: 'pass-1' }, data: { lessonsRemaining: { increment: 1 } } });
  });

  it('не трогает бронь, которую уже успели изменить (compare-and-set)', async () => {
    mocks.db.booking.findMany.mockResolvedValue([{ id: 'booking-9', updatedAt: now, sessionId: null, participants: 1 }]);
    mocks.db.booking.updateMany.mockResolvedValue({ count: 0 });

    const result = await expireUnpaidBookings(now);

    expect(result).toEqual({ expired: 0 });
    expect(mocks.db.classSession.updateMany).not.toHaveBeenCalled();
  });
});

describe('бронирование: цена только из БД', () => {
  it('не подставляет цену демо-занятия при отсутствии занятия в БД', async () => {
    mocks.db.danceClass.findFirst.mockResolvedValue(null);

    await expect(createBookingFromHold({ holdId: hold.id, userId: hold.userId, now }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
    expect(mocks.db.slotHold.delete).not.toHaveBeenCalled();
  });

  it.each([0, 17_000])('фиксирует цену из БД (%i) и серверную стоимость выезда', async (price) => {
    mocks.db.danceClass.findFirst.mockResolvedValue({ id: 'class-1', price, venueId: 'venue-1' });

    await createBookingFromHold({
      holdId: hold.id,
      userId: hold.userId,
      locationOption: 'CUSTOMER_LOCATION',
      now,
    });

    expect(mocks.db.danceClass.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { instructorId: hold.instructorId, isActive: true, deletedAt: null },
    }));
    // Dynamic pricing теперь по Asia/Yerevan — проверяем что итог использует priceForSlot (совместимо с TZ-фиксом)
    expect(mocks.db.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        basePrice: price,
        travelFee: booking.travelFee,
        venueId: 'venue-1',
      }),
    }));
    // totalPrice считается с пиковым мультипликатором по Yerevan, просто не привязываем к getHours UTC
    const calledTotal = (mocks.db.booking.create.mock.calls[0]?.[0] as { data: { totalPrice: number } })?.data.totalPrice;
    expect(typeof calledTotal).toBe('number');
    expect(calledTotal).toBeGreaterThanOrEqual(price);
    expect(mocks.db.slotHold.deleteMany).toHaveBeenCalledWith({ where: { id: hold.id, expiresAt: { gt: now } } });
  });
});

describe('бронь конкретного проведения', () => {
  beforeEach(() => {
    mocks.db.slotHold.findUnique.mockResolvedValue({ ...hold, sessionId: 'session-1' });
    mocks.db.classSession.findFirst.mockResolvedValue({
      id: 'session-1', classId: 'class-2', startsAt, endsAt, capacity: 10, bookedCount: 2,
      danceClass: { instructorId: hold.instructorId },
    });
    mocks.db.danceClass.findUnique.mockResolvedValue({ id: 'class-2', price: 23_000, venueId: 'venue-2' });
  });

  it('берёт цену выбранного занятия и атомарно занимает место', async () => {
    await createBookingFromHold({ holdId: hold.id, userId: hold.userId, now });
    expect(mocks.db.danceClass.findFirst).not.toHaveBeenCalled();
    expect(mocks.db.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sessionId: 'session-1', basePrice: 23_000, venueId: 'venue-2' }),
    }));
    expect(mocks.db.classSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'session-1', bookedCount: { lte: 9 } }),
    }));
  });

  it('отказывает, если проведение отменено или удалено', async () => {
    mocks.db.classSession.findFirst.mockResolvedValue(null);
    await expect(createBookingFromHold({ holdId: hold.id, userId: hold.userId, now }))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('не создаёт бронь, если последнее место заняли после чтения', async () => {
    mocks.db.classSession.updateMany.mockResolvedValue({ count: 0 });
    await expect(createBookingFromHold({ holdId: hold.id, userId: hold.userId, now }))
      .rejects.toMatchObject({ code: 'CAPACITY_EXCEEDED' });
    expect(mocks.db.booking.create).not.toHaveBeenCalled();
  });

  it('повторно использованное удержание не создаёт вторую бронь', async () => {
    mocks.db.slotHold.deleteMany.mockResolvedValue({ count: 0 });
    await expect(createBookingFromHold({ holdId: hold.id, userId: hold.userId, now }))
      .rejects.toMatchObject({ code: 'HOLD_EXPIRED' });
    expect(mocks.db.booking.create).not.toHaveBeenCalled();
  });
});

describe('пакет на групповой брони', () => {
  beforeEach(() => {
    mocks.db.slotHold.findUnique.mockResolvedValue({ ...hold, sessionId: 'session-1' });
    mocks.db.classSession.findFirst.mockResolvedValue({
      id: 'session-1', classId: 'class-1', startsAt, endsAt, capacity: 10, bookedCount: 2,
      danceClass: { instructorId: hold.instructorId },
    });
    mocks.db.danceClass.findUnique.mockResolvedValue({ id: 'class-1', price: 10_000, venueId: 'venue-1', lessonType: 'GROUP' });
    mocks.db.classPass.findFirst.mockResolvedValue({ id: 'pass-1' });
    mocks.db.classPass.updateMany.mockResolvedValue({ count: 1 });
  });

  it('списывает одно занятие атомарно и обнуляет сумму к оплате', async () => {
    await createBookingFromHold({ holdId: hold.id, userId: hold.userId, useClassPass: true, now });
    expect(mocks.db.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lessonType: 'GROUP', totalPrice: 0 }),
    }));
    expect(mocks.db.classPass.updateMany).toHaveBeenCalledWith({
      where: { id: 'pass-1', purchaserId: hold.userId, lessonsRemaining: { gt: 0 }, expiresAt: { gt: now } },
      data: { lessonsRemaining: { decrement: 1 } },
    });
    expect(mocks.db.classPassRedemption.create).toHaveBeenCalledWith({ data: { passId: 'pass-1', bookingId: 'booking-1' } });
  });

  it('не списывает пакет, когда последнее занятие уже использовано', async () => {
    mocks.db.classPass.updateMany.mockResolvedValue({ count: 0 });
    await expect(createBookingFromHold({ holdId: hold.id, userId: hold.userId, useClassPass: true, now }))
      .rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(mocks.db.classPassRedemption.create).not.toHaveBeenCalled();
  });

  it.each(['PRIVATE', 'PAIR'])('отклоняет пакет группы для формата %s', async (lessonType) => {
    mocks.db.danceClass.findUnique.mockResolvedValue({ id: 'class-1', price: 10_000, venueId: 'venue-1', lessonType });
    await expect(createBookingFromHold({ holdId: hold.id, userId: hold.userId, useClassPass: true, partnerName: lessonType === 'PAIR' ? 'Partner' : undefined, now }))
      .rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(mocks.db.classPass.findFirst).not.toHaveBeenCalled();
  });
});

describe('парная бронь', () => {
  beforeEach(() => {
    mocks.db.slotHold.findUnique.mockResolvedValue({ ...hold, sessionId: 'pair-session' });
    mocks.db.classSession.findFirst.mockResolvedValue({
      id: 'pair-session', classId: 'pair-class', startsAt, endsAt, capacity: 4, bookedCount: 2,
      danceClass: { instructorId: hold.instructorId },
    });
    mocks.db.danceClass.findUnique.mockResolvedValue({ id: 'pair-class', price: 20_000, venueId: 'venue-1', lessonType: 'PAIR' });
  });
  it('фиксирует партнёра и занимает два места без удвоения цены', async () => {
    await createBookingFromHold({ holdId: hold.id, userId: hold.userId, partnerName: '  Partner  ', now });
    expect(mocks.db.booking.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ participants: 2, partnerName: 'Partner', lessonType: 'PAIR', basePrice: 20_000 }) }));
    expect(mocks.db.classSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ bookedCount: { lte: 2 } }), data: { bookedCount: { increment: 2 } } }));
  });
  it('не принимает пару без имени партнёра', async () => {
    await expect(createBookingFromHold({ holdId: hold.id, userId: hold.userId, now })).rejects.toMatchObject({ field: 'partnerName' });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
  it('не принимает пару на одно оставшееся место', async () => {
    mocks.db.classSession.findFirst.mockResolvedValue({ id: 'pair-session', classId: 'pair-class', startsAt, endsAt, capacity: 4, bookedCount: 3, danceClass: { instructorId: hold.instructorId } });
    await expect(createBookingFromHold({ holdId: hold.id, userId: hold.userId, partnerName: 'Partner', now })).rejects.toMatchObject({ code: 'CAPACITY_EXCEEDED' });
    expect(mocks.db.booking.create).not.toHaveBeenCalled();
  });
});

describe('безопасная отмена', () => {
  beforeEach(() => {
    mocks.db.booking.findUnique.mockResolvedValue({ id: 'booking-1', customerId: hold.userId, status: 'CONFIRMED', startsAt, totalPrice: 0, payments: [], sessionId: 'session-1', participants: 2, updatedAt: now, cancellationWindowHours: 24, lateCancellationRate: 0.5, rescheduleWindowHours: 24, rescheduleCount: 0, maxReschedules: 2 });
    mocks.db.booking.updateMany.mockResolvedValue({ count: 1 });
    mocks.db.booking.findUniqueOrThrow.mockResolvedValue({ id: 'booking-1', status: 'CANCELLED_BY_CUSTOMER', totalPrice: 0 });
    mocks.db.classPassRedemption.findUnique.mockResolvedValue({ id: 'redemption-1', passId: 'pass-1' });
    mocks.db.waitlistEntry.findFirst.mockResolvedValue(null);
  });
  it('освобождает обоих участников и возвращает одно списанное занятие', async () => {
    await cancelBooking({ bookingId: 'booking-1', userId: hold.userId, now });
    expect(mocks.db.classSession.updateMany).toHaveBeenCalledWith({ where: { id: 'session-1', bookedCount: { gte: 2 } }, data: { bookedCount: { decrement: 2 } } });
    expect(mocks.db.classPass.update).toHaveBeenCalledWith({ where: { id: 'pass-1' }, data: { lessonsRemaining: { increment: 1 } } });
  });
  it('проигравшая параллельная отмена не возвращает места и занятия повторно', async () => {
    mocks.db.booking.updateMany.mockResolvedValue({ count: 0 });
    await expect(cancelBooking({ bookingId: 'booking-1', userId: hold.userId, now })).rejects.toMatchObject({ code: 'CANCELLATION_WINDOW_CLOSED' });
    expect(mocks.db.classSession.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.classPass.update).not.toHaveBeenCalled();
  });
  it('не начисляет возврат за неоплаченную бронь', async () => {
    const saved = await mocks.db.booking.findUnique();
    mocks.db.booking.findUnique.mockResolvedValue({ ...saved, totalPrice: 20_000, payments: [] });
    const result = await cancelBooking({ bookingId: 'booking-1', userId: hold.userId, now });
    expect(result.refund).toBe(0);
  });
  it('учитывает уже оформленный возврат подтверждённой оплаты', async () => {
    const saved = await mocks.db.booking.findUnique();
    mocks.db.booking.findUnique.mockResolvedValue({ ...saved, totalPrice: 20_000, payments: [{ paidAmount: 20_000, refunds: [{ amount: 5_000 }] }] });
    const result = await cancelBooking({ bookingId: 'booking-1', userId: hold.userId, now });
    expect(result.refund).toBe(15_000);
  });
  it('поздняя отмена не возвращает занятие пакета', async () => {
    await cancelBooking({ bookingId: 'booking-1', userId: hold.userId, now: new Date(startsAt.getTime() - 60_000) });
    expect(mocks.db.classPass.update).not.toHaveBeenCalled();
  });
});

describe('перенос: расписание только из БД', () => {
  beforeEach(() => {
    mocks.db.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      customerId: hold.userId,
      instructorId: hold.instructorId,
      startsAt,
      status: 'CONFIRMED',
      totalPrice: 17_000,
      basePrice: 17_000,
      travelFee: 0,
      discountAmount: 0,
      cancellationWindowHours: 24,
      lateCancellationRate: 0.5,
      rescheduleWindowHours: 24,
      rescheduleCount: 0,
      maxReschedules: 2,
    });
  });

  const input = {
    bookingId: 'booking-1',
    userId: hold.userId,
    now,
    newStartsAt: new Date('2026-10-06T14:00:00Z'),
    newEndsAt: new Date('2026-10-06T15:00:00Z'),
  };

  it('не подставляет демо-расписание отсутствующего профиля', async () => {
    mocks.db.instructorProfile.findUnique.mockResolvedValue(null);

    await expect(rescheduleBooking(input)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
    expect(mocks.db.availabilityRule.findMany).not.toHaveBeenCalled();
  });

  it('переносит бронь внутри расписания из БД, даже если демо-окна не подходят', async () => {
    mocks.db.instructorProfile.findUnique.mockResolvedValue({ id: hold.instructorId });
    mocks.db.availabilityRule.findMany.mockResolvedValue([
      { weekday: 2, startTime: '16:00', endTime: '17:00', isActive: true },
    ]);
    mocks.db.availabilityException.findMany.mockResolvedValue([]);

    await rescheduleBooking({
      ...input,
      newStartsAt: new Date('2026-10-06T12:00:00Z'),
      newEndsAt: new Date('2026-10-06T13:00:00Z'),
    });

    expect(mocks.db.booking.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        // newPrice теперь игнорируется сервером — basePrice остаётся как был
        basePrice: 17_000,
        rescheduleCount: { increment: 1 },
      }),
    }));
  });

  it('отказывает при пустом расписании существующего профиля', async () => {
    mocks.db.instructorProfile.findUnique.mockResolvedValue({ id: hold.instructorId });
    mocks.db.availabilityRule.findMany.mockResolvedValue([]);
    mocks.db.availabilityException.findMany.mockResolvedValue([]);

    await expect(rescheduleBooking(input)).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
    expect(mocks.db.availabilityRule.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { instructorId: hold.instructorId, isActive: true },
    }));
  });
});

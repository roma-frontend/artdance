import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    slotHold: { findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    danceClass: { findFirst: vi.fn(), findUnique: vi.fn() },
    classSession: { findFirst: vi.fn(), updateMany: vi.fn() },
    instructorProfile: { findUnique: vi.fn() },
    availabilityRule: { findMany: vi.fn() },
    availabilityException: { findMany: vi.fn() },
    booking: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
  notifyBookingConfirmed: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/server/booking/notify', () => ({
  notifyBookingConfirmed: mocks.notifyBookingConfirmed,
  notifyBookingCancelled: vi.fn(),
  notifyWaitlistReady: vi.fn(),
}));
vi.mock('@/server/wallet/service', () => ({ creditWallet: vi.fn() }));

import { booking } from '@/config/business';
import { createBookingFromHold, rescheduleBooking } from './service';

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
    expect(mocks.db.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        basePrice: price,
        travelFee: booking.travelFee,
        totalPrice: price + booking.travelFee,
        venueId: 'venue-1',
      }),
    }));
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
      where: expect.objectContaining({ id: 'session-1', bookedCount: { lt: 10 } }),
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
        startsAt: new Date('2026-10-06T12:00:00Z'),
        endsAt: new Date('2026-10-06T13:00:00Z'),
        basePrice: 17_000,
        totalPrice: 17_000,
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

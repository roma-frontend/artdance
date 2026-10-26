import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    event: { findFirst: vi.fn(), updateMany: vi.fn() },
    booking: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
  notifyBookingConfirmed: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/server/booking/notify', () => ({ notifyBookingConfirmed: mocks.notifyBookingConfirmed }));

import { createEventBooking } from './booking';

const now = new Date('2026-10-01T08:00:00Z');
const event = {
  id: 'event-1',
  title: 'Bachata Night',
  venueId: 'venue-1',
  startsAt: new Date('2026-10-03T16:00:00Z'),
  endsAt: new Date('2026-10-03T19:00:00Z'),
  price: 8_000,
  capacity: 20,
  registrationOpenAt: null,
  registrationCloseAt: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.$transaction.mockImplementation(async (handler) => handler(mocks.db));
  mocks.db.event.findFirst.mockResolvedValue(event);
  mocks.db.event.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.booking.findFirst.mockResolvedValue(null);
  mocks.db.booking.create.mockResolvedValue({ id: 'booking-1' });
  mocks.db.booking.update.mockResolvedValue({
    id: 'booking-1',
    reference: 'BK-OKING-1',
    totalPrice: event.price,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    status: 'PENDING',
  });
  mocks.notifyBookingConfirmed.mockResolvedValue(undefined);
});

describe('обычная регистрация на событие', () => {
  it('резервирует место и создаёт ожидающую оплату бронь', async () => {
    const result = await createEventBooking({ userId: 'customer-1', eventSlug: 'bachata-night', now });

    expect(result).toMatchObject({ id: 'booking-1', totalPrice: event.price, status: 'PENDING', title: event.title });
    expect(mocks.db.event.updateMany).toHaveBeenCalledWith({
      where: { id: event.id, bookedCount: { lt: event.capacity } },
      data: { bookedCount: { increment: 1 } },
    });
    expect(mocks.db.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ subject: 'EVENT_TICKET', eventId: event.id, status: 'PENDING', customerId: 'customer-1' }),
    }));
    expect(mocks.notifyBookingConfirmed).not.toHaveBeenCalled();
  });

  it('создаёт подтверждённую бронь для бесплатного события', async () => {
    mocks.db.event.findFirst.mockResolvedValue({ ...event, price: 0 });
    mocks.db.booking.update.mockResolvedValue({
      id: 'booking-1',
      reference: 'BK-OKING-1',
      totalPrice: 0,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      status: 'CONFIRMED',
    });

    const result = await createEventBooking({ userId: 'customer-1', eventSlug: 'bachata-night', now });

    expect(result.status).toBe('CONFIRMED');
    expect(mocks.notifyBookingConfirmed).toHaveBeenCalledWith('booking-1');
  });

  it('не создаёт вторую активную бронь на то же событие', async () => {
    mocks.db.booking.findFirst.mockResolvedValue({ id: 'existing-booking' });

    await expect(createEventBooking({ userId: 'customer-1', eventSlug: 'bachata-night', now })).rejects.toMatchObject({ code: 'DUPLICATE_ENROLLMENT' });
    expect(mocks.db.event.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.booking.create).not.toHaveBeenCalled();
  });

  it('отклоняет бронь, если все места заняты, и не создаёт бронь', async () => {
    mocks.db.event.updateMany.mockResolvedValue({ count: 0 });

    await expect(createEventBooking({ userId: 'customer-1', eventSlug: 'bachata-night', now })).rejects.toMatchObject({ code: 'CAPACITY_EXCEEDED' });
    expect(mocks.db.booking.create).not.toHaveBeenCalled();
    expect(mocks.notifyBookingConfirmed).not.toHaveBeenCalled();
  });
});

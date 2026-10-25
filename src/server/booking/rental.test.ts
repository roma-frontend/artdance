import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    slotHold: { findUnique: vi.fn(), deleteMany: vi.fn() },
    room: { findFirst: vi.fn() },
    booking: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    classSession: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  assertEntitlementOrThrow: vi.fn(),
  notifyBookingConfirmed: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/server/booking/notify', () => ({
  notifyBookingConfirmed: mocks.notifyBookingConfirmed,
  notifyBookingCancelled: vi.fn(),
  notifyWaitlistReady: vi.fn(),
}));
vi.mock('@/server/wallet/service', () => ({ creditWallet: vi.fn() }));
vi.mock('@/server/entitlements/guard', () => ({ assertEntitlementOrThrow: mocks.assertEntitlementOrThrow }));

import { createBookingFromHold } from './service';

const now = new Date('2026-10-01T08:00:00Z');
const startsAt = new Date('2026-10-03T14:00:00Z');
const rentalHold = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'hold-r1',
  userId: 'customer-1',
  anonymousId: null,
  instructorId: null,
  roomId: 'room-1',
  sessionId: null,
  startsAt,
  endsAt: new Date('2026-10-03T16:00:00Z'),
  expiresAt: new Date('2026-10-01T08:10:00Z'),
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.assertEntitlementOrThrow.mockResolvedValue(undefined);
  mocks.db.slotHold.findUnique.mockResolvedValue(rentalHold());
  mocks.db.slotHold.deleteMany.mockResolvedValue({ count: 1 });
  mocks.db.room.findFirst.mockResolvedValue({ id: 'room-1', venueId: 'venue-1', pricePerHour: 6000 });
  mocks.db.booking.findFirst.mockResolvedValue(null);
  mocks.db.classSession.findFirst.mockResolvedValue(null);
  mocks.db.booking.create.mockResolvedValue({ id: 'booking-r1' });
  mocks.db.booking.update.mockResolvedValue({ id: 'booking-r1', reference: 'BK-R1', totalPrice: 12000, startsAt, endsAt: new Date('2026-10-03T16:00:00Z') });
  mocks.db.$transaction.mockImplementation(async (handler) => handler(mocks.db));
  mocks.notifyBookingConfirmed.mockResolvedValue(undefined);
});

describe('аренда зала через createBookingFromHold', () => {
  it('создаёт PENDING-бронь STUDIO_RENTAL с ценой за часы и без подтверждения', async () => {
    const result = await createBookingFromHold({ holdId: 'hold-r1', userId: 'customer-1', now });

    expect(result.reference).toBe('BK-R1');
    expect(mocks.db.booking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ subject: 'STUDIO_RENTAL', status: 'PENDING', roomId: 'room-1', instructorId: null, totalPrice: 12000, basePrice: 6000 }),
    }));
    expect(mocks.notifyBookingConfirmed).not.toHaveBeenCalled();
  });

  it('отклоняет аренду, если модуль events выключен, и ничего не создаёт', async () => {
    mocks.assertEntitlementOrThrow.mockRejectedValue(Object.assign(new Error('off'), { code: 'FEATURE_DISABLED' }));

    await expect(createBookingFromHold({ holdId: 'hold-r1', userId: 'customer-1', now })).rejects.toMatchObject({ code: 'FEATURE_DISABLED' });
    expect(mocks.db.booking.create).not.toHaveBeenCalled();
  });

  it('отклоняет длительность вне правил и ничего не создаёт', async () => {
    mocks.db.slotHold.findUnique.mockResolvedValue(rentalHold({ endsAt: new Date('2026-10-03T14:45:00Z') }));

    await expect(createBookingFromHold({ holdId: 'hold-r1', userId: 'customer-1', now })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(mocks.db.booking.create).not.toHaveBeenCalled();
  });

  it('отклоняет конфликт с действующей бронью зала', async () => {
    mocks.db.booking.findFirst.mockResolvedValue({ id: 'other' });

    await expect(createBookingFromHold({ holdId: 'hold-r1', userId: 'customer-1', now })).rejects.toMatchObject({ code: 'SLOT_CONFLICT' });
    expect(mocks.db.booking.create).not.toHaveBeenCalled();
  });

  it('отклоняет аренду, если на зал в это время назначено занятие', async () => {
    mocks.db.classSession.findFirst.mockResolvedValue({ id: 'session-1' });

    await expect(createBookingFromHold({ holdId: 'hold-r1', userId: 'customer-1', now })).rejects.toMatchObject({ code: 'SLOT_CONFLICT' });
    expect(mocks.db.booking.create).not.toHaveBeenCalled();
  });

  it('отклоняет истёкший холд', async () => {
    mocks.db.slotHold.findUnique.mockResolvedValue(rentalHold({ expiresAt: new Date('2026-10-01T07:00:00Z') }));

    await expect(createBookingFromHold({ holdId: 'hold-r1', userId: 'customer-1', now })).rejects.toMatchObject({ code: 'HOLD_EXPIRED' });
    expect(mocks.db.booking.create).not.toHaveBeenCalled();
  });

  it('требует вход: анонимный холд не оформляет аренду', async () => {
    mocks.db.slotHold.findUnique.mockResolvedValue(rentalHold({ userId: null, anonymousId: 'anon-1' }));

    await expect(createBookingFromHold({ holdId: 'hold-r1', anonymousId: 'anon-1', now })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mocks.db.booking.create).not.toHaveBeenCalled();
  });
});

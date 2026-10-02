import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    instructorProfile: { findFirst: vi.fn() },
    classSession: { findFirst: vi.fn() },
    availabilityRule: { findMany: vi.fn() },
    availabilityException: { findMany: vi.fn() },
    booking: { findMany: vi.fn() },
    slotHold: { findMany: vi.fn() },
  },
  createSlotHold: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/lib/auth/guards', () => ({ getCaller: vi.fn(async () => ({ id: 'customer-1' })) }));
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  clientIdentifier: vi.fn(() => 'test'),
  rateLimitHeaders: vi.fn(),
}));
vi.mock('@/server/hold/service', () => ({
  createSlotHold: mocks.createSlotHold,
  extendSlotHold: vi.fn(),
  releaseSlotHold: vi.fn(),
}));

import { booking } from '@/config/business';
import { slotBlockingBookingStatuses } from '@/domain/enums';
import { POST } from './route';

const startsAt = new Date('2026-10-06T06:00:00Z');
const endsAt = new Date('2026-10-06T07:00:00Z');
const request = (extra: object = {}) => new Request('https://artdance.test/api/booking/hold', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ instructorId: 'anna-mkrtchyan', startsAt, endsAt, ...extra }),
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.instructorProfile.findFirst.mockResolvedValue({ id: 'profile-1' });
  mocks.db.availabilityRule.findMany.mockResolvedValue([]);
  mocks.db.availabilityException.findMany.mockResolvedValue([]);
  mocks.db.booking.findMany.mockResolvedValue([]);
  mocks.db.slotHold.findMany.mockResolvedValue([]);
  mocks.createSlotHold.mockResolvedValue({ id: 'hold-1', startsAt, endsAt, expiresAt: endsAt, extensions: 0 });
});

describe('POST /api/booking/hold — ресурс из БД', () => {
  it('разрешает слаг в ID до проверки занятости и создания удержания', async () => {
    expect((await POST(request())).status).toBe(201);
    expect(mocks.db.instructorProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ moderation: 'APPROVED', OR: [{ id: 'anna-mkrtchyan' }, { slug: 'anna-mkrtchyan' }] }),
    }));
    expect(mocks.createSlotHold).toHaveBeenCalledWith(expect.objectContaining({ instructorId: 'profile-1' }));
    const bufferMs = booking.bufferBetweenBookingsMinutes * 60_000;
    expect(mocks.db.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        instructorId: 'profile-1', status: { in: [...slotBlockingBookingStatuses] },
        startsAt: { lt: new Date(endsAt.getTime() + bufferMs) },
        endsAt: { gt: new Date(startsAt.getTime() - bufferMs) },
      }),
    }));
    expect(mocks.db.slotHold.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ instructorId: 'profile-1', expiresAt: { gt: expect.any(Date) } }),
    }));
  });

  it('проведение определяет ресурс, окно и вместимость; вошедшему не пишется anonymousId', async () => {
    mocks.db.classSession.findFirst.mockResolvedValue({
      startsAt, endsAt, capacity: 10, bookedCount: 3,
      danceClass: { instructorId: 'profile-1', instructor: { slug: 'anna-mkrtchyan' } },
    });
    expect((await POST(request({ sessionId: 'session-1', anonymousId: 'anon-1' }))).status).toBe(201);
    expect(mocks.createSlotHold).toHaveBeenCalledWith(expect.objectContaining({
      instructorId: 'profile-1', roomId: null, sessionId: 'session-1', anonymousId: null,
      capacity: { booked: 3, requested: 1, total: 10 },
      exceptions: [{ start: startsAt, end: endsAt, isAvailable: true }],
    }));
  });

  it('нельзя подменить время проведения', async () => {
    mocks.db.classSession.findFirst.mockResolvedValue({
      startsAt: new Date(startsAt.getTime() + 60_000), endsAt, capacity: 10, bookedCount: 3,
      danceClass: { instructorId: 'profile-1', instructor: { slug: 'anna-mkrtchyan' } },
    });
    expect((await POST(request({ sessionId: 'session-1' }))).status).toBe(400);
    expect(mocks.createSlotHold).not.toHaveBeenCalled();
  });

  it('отсутствующий профиль не получает расписание из фикстур', async () => {
    mocks.db.instructorProfile.findFirst.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'NOT_FOUND' });
    expect(mocks.createSlotHold).not.toHaveBeenCalled();
    expect(mocks.db.availabilityRule.findMany).not.toHaveBeenCalled();
  });
});

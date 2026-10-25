/**
 * Дашборд площадки видит только свои площадки и только подтверждённые будущие брони.
 * Данные клиента в выборку не попадают.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    venueMember: { findMany: vi.fn() },
    booking: { findMany: vi.fn() },
  },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: mocks.db }));

import { getVenueDashboard } from './dashboard';

describe('getVenueDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty result and skips booking lookup when the user has no venues', async () => {
    mocks.db.venueMember.findMany.mockResolvedValue([]);

    const result = await getVenueDashboard('user-1');

    expect(result).toEqual({ venues: [], bookings: [] });
    expect(mocks.db.booking.findMany).not.toHaveBeenCalled();
  });

  it('limits membership to the user and bookings to the user venues, confirmed and upcoming', async () => {
    const now = new Date('2026-05-01T10:00:00Z');
    mocks.db.venueMember.findMany.mockResolvedValue([
      { venue: { id: 'venue-1', slug: 'hall', name: 'Hall', district: 'Center', rooms: [] } },
    ]);
    mocks.db.booking.findMany.mockResolvedValue([]);

    const result = await getVenueDashboard('user-1', now);

    expect(mocks.db.venueMember.findMany.mock.calls[0]?.[0]?.where).toEqual({
      userId: 'user-1',
      venue: { deletedAt: null },
    });
    expect(mocks.db.booking.findMany.mock.calls[0]?.[0]?.where).toEqual({
      venueId: { in: ['venue-1'] },
      status: 'CONFIRMED',
      startsAt: { gte: now },
    });
    expect(result.venues).toEqual([
      { id: 'venue-1', slug: 'hall', name: 'Hall', district: 'Center', rooms: [] },
    ]);
  });

  it('does not select customer personal data', async () => {
    mocks.db.venueMember.findMany.mockResolvedValue([
      { venue: { id: 'venue-1', slug: 'hall', name: 'Hall', district: 'Center', rooms: [] } },
    ]);
    mocks.db.booking.findMany.mockResolvedValue([]);

    await getVenueDashboard('user-1');

    const select = mocks.db.booking.findMany.mock.calls[0]?.[0]?.select;
    expect(select).not.toHaveProperty('customer');
    expect(select).not.toHaveProperty('customerId');
    expect(select).not.toHaveProperty('totalPrice');
  });
});

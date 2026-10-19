import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireOperator: vi.fn(),
  getUserDetail: vi.fn(),
  db: {
    booking: { findMany: vi.fn() },
    order: { findMany: vi.fn() },
    supportTicket: { findMany: vi.fn() },
    review: { findMany: vi.fn() },
    session: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth/guards', () => ({ requireOperator: mocks.requireOperator }));
vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('./people', () => ({ getUserDetail: mocks.getUserDetail }));

import { getUser360 } from './user-360';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireOperator.mockResolvedValue({ id: 'operator', role: 'SUPPORT' });
  mocks.getUserDetail.mockResolvedValue({ id: 'user-1', email: 'anna@example.com', name: 'Anna', createdAt: new Date('2026-01-01T00:00:00Z') });
  mocks.db.booking.findMany.mockResolvedValue([]);
  mocks.db.order.findMany.mockResolvedValue([]);
  mocks.db.supportTicket.findMany.mockResolvedValue([]);
  mocks.db.review.findMany.mockResolvedValue([]);
  mocks.db.session.findMany.mockResolvedValue([]);
  mocks.db.auditLog.findMany.mockResolvedValue([]);
});

describe('getUser360', () => {
  it('combines related activity and matches tickets by email', async () => {
    mocks.db.booking.findMany.mockResolvedValue([{ id: 'booking-1', reference: 'BK-1', subject: 'CLASS_SESSION', status: 'CONFIRMED', startsAt: new Date('2026-02-01T10:00:00Z'), totalPrice: 1000, currencyCode: 'AMD' }]);
    mocks.db.supportTicket.findMany.mockResolvedValue([{ id: 'ticket-1', topic: 'Payment', status: 'OPEN', priority: 'HIGH', createdAt: new Date('2026-02-02T10:00:00Z'), updatedAt: new Date('2026-02-02T10:00:00Z') }]);
    mocks.db.auditLog.findMany.mockResolvedValue([{ id: 'audit-1', action: 'admin.support.reply', entityType: 'SupportTicket', entityId: 'ticket-1', actorEmail: 'operator@example.com', diff: null, createdAt: new Date('2026-02-02T11:00:00Z') }]);

    const result = await getUser360('user-1');

    expect(mocks.db.supportTicket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'anna@example.com' } }));
    expect(result?.timeline.map((item) => item.type)).toEqual(['audit', 'ticket', 'booking', 'user']);
    expect(result?.bookings[0]?.startsAt).toBe('2026-02-01T10:00:00.000Z');
  });
});

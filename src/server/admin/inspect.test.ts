import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireOperator: vi.fn(),
  getUserDetail: vi.fn(),
  getOrderDetail: vi.fn(),
  getBookingDetail: vi.fn(),
  db: {
    user: { findFirst: vi.fn() },
    order: { findFirst: vi.fn() },
    booking: { findFirst: vi.fn() },
    supportTicket: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/auth/guards', () => ({ requireOperator: mocks.requireOperator }));
vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('./people', () => ({ getUserDetail: mocks.getUserDetail }));
vi.mock('./operations', () => ({ getOrderDetail: mocks.getOrderDetail, getBookingDetail: mocks.getBookingDetail }));

import { formatEntityPreview, formatInspect, inspectOperatorRecord } from './inspect';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireOperator.mockResolvedValue({ id: 'operator', role: 'SUPPORT' });
});

describe('inspectOperatorRecord', () => {
  it('resolves a user by email and uses the safe detail query', async () => {
    mocks.db.user.findFirst.mockResolvedValue({ id: 'user-1' });
    mocks.getUserDetail.mockResolvedValue({ id: 'user-1', name: 'Anna', email: 'anna@example.com' });

    const result = await inspectOperatorRecord('users', 'anna@example.com');

    expect(result).toEqual({ model: 'User', id: 'user-1', record: { id: 'user-1', name: 'Anna', email: 'anna@example.com' } });
    expect(mocks.db.user.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ id: 'anna@example.com' }, { email: 'anna@example.com' }] },
      select: { id: true },
    });
  });

  it('formats nested support information and masks phone numbers', () => {
    const lines = formatInspect({
      model: 'SupportTicket',
      id: 'ticket-1',
      record: {
        id: 'ticket-1', status: 'OPEN', phone: '+37499123456', message: 'Payment problem',
        replies: [{ body: 'We are checking', internal: true }],
      },
    });

    expect(lines.join('\n')).toContain('phone: ***3456');
    expect(lines.join('\n')).toContain('replies: 1');
    expect(lines.join('\n')).toContain('body: We are checking');
  });

  it('creates a compact preview DTO without exposing the full record', () => {
    const preview = formatEntityPreview({ model: 'User', id: 'user-1', record: { name: 'Anna', email: 'anna@example.com', role: 'CUSTOMER', isActive: true, passwordHash: 'hidden' } });
    expect(preview).toEqual(expect.objectContaining({ model: 'User', id: 'user-1', title: 'Anna', subtitle: 'anna@example.com', status: 'active' }));
    expect(JSON.stringify(preview)).not.toContain('hidden');
  });
});

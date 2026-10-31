import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Caller } from '@/lib/auth/guards';

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  redemptionFind: vi.fn(),
  recordAudit: vi.fn(),
  recordReliabilityEvent: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    booking: { findUnique: h.findUnique },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        booking: { updateMany: h.updateMany, findUniqueOrThrow: h.findUniqueOrThrow },
        classPassRedemption: { findUnique: h.redemptionFind },
      }),
  },
}));
vi.mock('@/lib/audit', () => ({ recordAudit: h.recordAudit }));
vi.mock('@/server/reliability/service', () => ({ recordReliabilityEvent: h.recordReliabilityEvent }));

import { cancelBookingAsStaff } from './staff-cancel';

const DAY = 24 * 60 * 60 * 1000;
const actor = { id: 'admin-1', email: 'admin@artdance.am', name: 'Админ', role: 'ADMIN', locale: 'ru' } as Caller;

/** Данные, которые ушли в первый вызов `updateMany`: по ним видно, какой статус записан. */
function updatedData(): Record<string, unknown> {
  const [args] = h.updateMany.mock.calls[0] as unknown as [{ data: Record<string, unknown> }];
  return args.data;
}

/** Бронь, до начала которой больше суток: отмена бесплатная, поздней она не считается. */
function bookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b1',
    status: 'CONFIRMED',
    startsAt: new Date(Date.now() + 10 * DAY),
    totalPrice: 10_000,
    cancellationWindowHours: 24,
    lateCancellationRate: 0.5,
    rescheduleWindowHours: 24,
    maxReschedules: 1,
    rescheduleCount: 0,
    updatedAt: new Date('2026-10-01T10:00:00Z'),
    sessionId: null,
    participants: 1,
    customerId: 'customer-1',
    instructor: { userId: 'instructor-1' },
    payments: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.redemptionFind.mockResolvedValue(null);
  h.updateMany.mockResolvedValue({ count: 1 });
  h.findUniqueOrThrow.mockResolvedValue({ id: 'b1', status: 'CANCELLED_BY_PROVIDER', cancelledAt: new Date() });
});

describe('cancelBookingAsStaff', () => {
  it('бронь не найдена — ошибка, ничего не меняется', async () => {
    h.findUnique.mockResolvedValue(null);

    await expect(cancelBookingAsStaff({ id: 'missing', reason: 'причина', byProvider: true, actor })).rejects.toThrow();
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.recordAudit).not.toHaveBeenCalled();
  });

  it('уже отменённую бронь не отменяет повторно', async () => {
    h.findUnique.mockResolvedValue(bookingRow({ status: 'CANCELLED_BY_CUSTOMER' }));

    await expect(cancelBookingAsStaff({ id: 'b1', reason: 'причина', byProvider: true, actor })).rejects.toThrow();
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it('отмена по инициативе площадки ставит CANCELLED_BY_PROVIDER и пишет журнал с причиной', async () => {
    h.findUnique.mockResolvedValue(bookingRow());

    const outcome = await cancelBookingAsStaff({ id: 'b1', reason: 'Зал закрыт', byProvider: true, actor, ipAddress: '10.0.0.1' });

    expect(updatedData().status).toBe('CANCELLED_BY_PROVIDER');
    expect(updatedData().cancellationReason).toBe('Зал закрыт');
    expect(h.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.booking.cancel', entityId: 'b1', reason: 'Зал закрыт', ipAddress: '10.0.0.1' }),
    );
    expect(outcome).toEqual({ fee: 0, refund: expect.any(Number) });
  });

  it('отмена без признака площадки ставит CANCELLED_BY_CUSTOMER', async () => {
    h.findUnique.mockResolvedValue(bookingRow());

    await cancelBookingAsStaff({ id: 'b1', reason: 'По просьбе клиента', byProvider: false, actor });

    expect(updatedData().status).toBe('CANCELLED_BY_CUSTOMER');
  });

  it('если бронь изменилась во время отмены, ничего не пишется в журнал', async () => {
    h.findUnique.mockResolvedValue(bookingRow());
    h.updateMany.mockResolvedValue({ count: 0 });

    await expect(cancelBookingAsStaff({ id: 'b1', reason: 'причина', byProvider: true, actor })).rejects.toThrow();
    expect(h.recordAudit).not.toHaveBeenCalled();
  });
});

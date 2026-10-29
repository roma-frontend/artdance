import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  db: {
    booking: { findMany: vi.fn(), updateMany: vi.fn() },
    waitlistEntry: { findMany: vi.fn() },
    reliabilityEvent: { findFirst: vi.fn(), create: vi.fn() },
    user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
  runPeriodicJobs: vi.fn(),
  purgeExpiredHolds: vi.fn(),
  purgeExpiredCarts: vi.fn(),
  expireUnpaidBookings: vi.fn(),
  expireBookingRequests: vi.fn(),
  remindBookingRequests: vi.fn(),
  notifyBookingReminder: vi.fn(),
  notifyWaitlistReady: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: h.db }));
vi.mock('@/server/cart/service', () => ({ purgeExpiredCarts: h.purgeExpiredCarts }));
vi.mock('@/server/hold/service', () => ({ purgeExpiredHolds: h.purgeExpiredHolds }));
vi.mock('@/server/booking/service', () => ({ expireUnpaidBookings: h.expireUnpaidBookings }));
vi.mock('@/server/booking/requests', () => ({
  expireBookingRequests: h.expireBookingRequests,
  remindBookingRequests: h.remindBookingRequests,
}));
vi.mock('@/server/booking/notify', () => ({
  notifyBookingReminder: h.notifyBookingReminder,
  notifyWaitlistReady: h.notifyWaitlistReady,
}));
vi.mock('@/server/cron/periodic', () => ({ runPeriodicJobs: h.runPeriodicJobs }));

import { runBookingCron } from './tasks';

const NOW = new Date('2026-10-05T12:00:00Z');

/** Выборка автозавершения — единственный запрос с полем endsAt; напоминания и лист ожидания его не используют. */
function autoCompleteCandidates(list: Array<{ id: string; instructor: { userId: string } | null }>) {
  h.db.booking.findMany.mockImplementation(async (args: { where: Record<string, unknown> }) => ('endsAt' in args.where ? list : []));
}

beforeEach(() => {
  vi.resetAllMocks();
  h.db.$transaction.mockImplementation(async (fn: (tx: typeof h.db) => unknown) => fn(h.db));
  h.runPeriodicJobs.mockResolvedValue({ sessionsPurged: 0, scheduledSent: 0, abandonedCartReminders: 0, onboardingSent: 0, digestSent: false });
  h.purgeExpiredHolds.mockResolvedValue({ purged: 0 });
  h.purgeExpiredCarts.mockResolvedValue({ purged: 0 });
  h.expireUnpaidBookings.mockResolvedValue({ expired: 0 });
  h.expireBookingRequests.mockResolvedValue({ expired: 0 });
  h.remindBookingRequests.mockResolvedValue({ reminded: 0 });
  autoCompleteCandidates([]);
  h.db.booking.updateMany.mockResolvedValue({ count: 0 });
  h.db.waitlistEntry.findMany.mockResolvedValue([]);
  h.db.reliabilityEvent.findFirst.mockResolvedValue(null);
  h.db.reliabilityEvent.create.mockResolvedValue({});
  h.db.user.findUniqueOrThrow.mockResolvedValue({ reliabilityScore: 80 });
  h.db.user.update.mockResolvedValue({});
  h.notifyBookingReminder.mockResolvedValue(undefined);
  h.notifyWaitlistReady.mockResolvedValue(undefined);
});

describe('автозавершение броней и засчитывание проведения (D-07)', () => {
  it('переводит бронь по одной и засчитывает проведение инструктору', async () => {
    autoCompleteCandidates([{ id: 'booking-1', instructor: { userId: 'instructor-user-1' } }]);
    h.db.booking.updateMany.mockResolvedValue({ count: 1 });

    const report = await runBookingCron(NOW);

    expect(h.db.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: 'CONFIRMED' },
      data: { status: 'COMPLETED', completedAt: NOW },
    });
    expect(report.autoCompleted).toBe(1);
    expect(h.db.reliabilityEvent.create).toHaveBeenCalledWith({ data: { userId: 'instructor-user-1', kind: 'COMPLETED', refId: 'booking-1' } });
    expect(h.db.user.update).toHaveBeenCalledWith({ where: { id: 'instructor-user-1' }, data: { reliabilityScore: 82 } });
  });

  it('аренда без инструктора переводится, но никому не засчитывается', async () => {
    autoCompleteCandidates([{ id: 'rental-1', instructor: null }]);
    h.db.booking.updateMany.mockResolvedValue({ count: 1 });

    const report = await runBookingCron(NOW);

    expect(report.autoCompleted).toBe(1);
    expect(h.db.reliabilityEvent.create).not.toHaveBeenCalled();
  });

  it('бронь, которую уже перевели или отменили, не считается и не засчитывается', async () => {
    autoCompleteCandidates([{ id: 'booking-1', instructor: { userId: 'instructor-user-1' } }]);
    h.db.booking.updateMany.mockResolvedValue({ count: 0 });

    const report = await runBookingCron(NOW);

    expect(report.autoCompleted).toBe(0);
    expect(h.db.reliabilityEvent.create).not.toHaveBeenCalled();
  });

  it('повторный прогон по той же брони не удваивает счёт', async () => {
    autoCompleteCandidates([{ id: 'booking-1', instructor: { userId: 'instructor-user-1' } }]);
    h.db.booking.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    await runBookingCron(NOW);
    await runBookingCron(NOW);

    expect(h.db.reliabilityEvent.create).toHaveBeenCalledTimes(1);
  });
});

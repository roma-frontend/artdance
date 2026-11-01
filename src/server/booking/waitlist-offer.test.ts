import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  sessionFind: vi.fn(),
  entryFindFirst: vi.fn(),
  entryUpdate: vi.fn(),
  entryFindUnique: vi.fn(),
  notifyWaitlistReady: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    classSession: { findUnique: h.sessionFind },
    waitlistEntry: {
      findFirst: h.entryFindFirst,
      update: h.entryUpdate,
      findUnique: h.entryFindUnique,
    },
  },
}));
vi.mock('@/server/booking/notify', () => ({ notifyWaitlistReady: h.notifyWaitlistReady }));

import { booking } from '@/config/business';

import { activeWaitlistClaim, offerFreedSeat } from './waitlist-offer';

const now = new Date('2026-11-01T10:00:00Z');
const WINDOW_MS = booking.waitlistClaimWindowMinutes * 60_000;

beforeEach(() => {
  vi.clearAllMocks();
  h.sessionFind.mockResolvedValue({ capacity: 5, bookedCount: 4, isCancelled: false });
  h.entryFindFirst.mockResolvedValue({ id: 'w1', userId: 'u1' });
  h.entryUpdate.mockResolvedValue({});
  h.notifyWaitlistReady.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('offerFreedSeat', () => {
  it('предлагает место первому без уведомления и отправляет письмо с окном удержания', async () => {
    await offerFreedSeat('s1', now);

    expect(h.entryUpdate).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { notifiedAt: now, claimUntil: new Date(now.getTime() + WINDOW_MS) },
    });
    expect(h.notifyWaitlistReady).toHaveBeenCalledWith('s1', 'u1', new Date(now.getTime() + WINDOW_MS));
  });

  it('ничего не делает, пока в занятии нет свободного места', async () => {
    h.sessionFind.mockResolvedValue({ capacity: 5, bookedCount: 5, isCancelled: false });

    await offerFreedSeat('s1', now);

    expect(h.entryFindFirst).not.toHaveBeenCalled();
    expect(h.notifyWaitlistReady).not.toHaveBeenCalled();
  });

  it('не предлагает место отменённого занятия', async () => {
    h.sessionFind.mockResolvedValue({ capacity: 5, bookedCount: 4, isCancelled: true });

    await offerFreedSeat('s1', now);

    expect(h.notifyWaitlistReady).not.toHaveBeenCalled();
  });

  it('пустой лист ожидания — тихий выход', async () => {
    h.entryFindFirst.mockResolvedValue(null);

    await offerFreedSeat('s1', now);

    expect(h.entryUpdate).not.toHaveBeenCalled();
    expect(h.notifyWaitlistReady).not.toHaveBeenCalled();
  });

  it('ошибка базы не пробрасывается: отмена уже зафиксирована', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.sessionFind.mockRejectedValue(new Error('db down'));

    await expect(offerFreedSeat('s1', now)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
  });
});

describe('activeWaitlistClaim', () => {
  it('возвращает окно, если место предложено и срок не истёк', async () => {
    const claimUntil = new Date(now.getTime() + 60_000);
    h.entryFindUnique.mockResolvedValue({ notifiedAt: now, claimUntil });

    await expect(activeWaitlistClaim('s1', 'u1', now)).resolves.toEqual({ claimUntil });
  });

  it('null, если записи нет, место не предлагали или окно истекло', async () => {
    h.entryFindUnique.mockResolvedValueOnce(null);
    await expect(activeWaitlistClaim('s1', 'u1', now)).resolves.toBeNull();

    h.entryFindUnique.mockResolvedValueOnce({ notifiedAt: null, claimUntil: null });
    await expect(activeWaitlistClaim('s1', 'u1', now)).resolves.toBeNull();

    h.entryFindUnique.mockResolvedValueOnce({ notifiedAt: now, claimUntil: new Date(now.getTime() - 1) });
    await expect(activeWaitlistClaim('s1', 'u1', now)).resolves.toBeNull();
  });
});

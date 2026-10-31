import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    waitlistEntry: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
    classSession: { findUnique: vi.fn() },
    danceClass: { findUnique: vi.fn() },
    slotHold: { create: vi.fn() },
  },
  hasConsent: vi.fn(),
  recordConsent: vi.fn(),
  flagBookingContactText: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/server/booking/notify', () => ({
  notifyBookingConfirmed: vi.fn(),
  notifyBookingCancelled: vi.fn(),
  notifyWaitlistReady: vi.fn(),
}));
vi.mock('@/server/wallet/service', () => ({ creditWallet: vi.fn() }));
vi.mock('@/lib/consent/store', () => ({ hasConsent: mocks.hasConsent, recordConsent: mocks.recordConsent }));
vi.mock('@/server/booking/guardrails', () => ({ flagBookingContactText: mocks.flagBookingContactText }));

import { claimWaitlistSlot } from './service';

const now = new Date('2026-11-01T10:00:00Z');
const startsAt = new Date('2026-11-02T14:00:00Z');
const endsAt = new Date('2026-11-02T15:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.waitlistEntry.findUnique.mockResolvedValue({
    id: 'w1',
    notifiedAt: now,
    claimUntil: new Date(now.getTime() + 60 * 60_000),
  });
  mocks.db.classSession.findUnique.mockResolvedValue({
    id: 's1',
    startsAt,
    endsAt,
    classId: 'c1',
    capacity: 5,
    bookedCount: 4,
  });
  mocks.db.danceClass.findUnique.mockResolvedValue({ instructorId: 'i1' });
  mocks.db.slotHold.create.mockResolvedValue({ id: 'h1', expiresAt: new Date(now.getTime() + 15 * 60_000) });
  mocks.db.waitlistEntry.delete.mockResolvedValue({});
  mocks.db.waitlistEntry.findMany.mockResolvedValue([]);
});

describe('claimWaitlistSlot', () => {
  it('удерживает занятие за инструктором: аудитория не назначается, ресурс один', async () => {
    const hold = await claimWaitlistSlot({ sessionId: 's1', userId: 'u1', now });

    expect(mocks.db.slotHold.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ instructorId: 'i1', roomId: null, sessionId: 's1', userId: 'u1' }),
      }),
    );
    expect(mocks.db.waitlistEntry.delete).toHaveBeenCalledWith({ where: { id: 'w1' } });
    expect(hold.id).toBe('h1');
  });

  it('полное занятие не удерживает место, даже если письмо пришло вовремя', async () => {
    mocks.db.classSession.findUnique.mockResolvedValue({
      id: 's1',
      startsAt,
      endsAt,
      classId: 'c1',
      capacity: 5,
      bookedCount: 5,
    });

    await expect(claimWaitlistSlot({ sessionId: 's1', userId: 'u1', now })).rejects.toThrow();
    expect(mocks.db.slotHold.create).not.toHaveBeenCalled();
    expect(mocks.db.waitlistEntry.delete).not.toHaveBeenCalled();
  });

  it('окно удержания истекло — место не отдаётся', async () => {
    mocks.db.waitlistEntry.findUnique.mockResolvedValue({
      id: 'w1',
      notifiedAt: now,
      claimUntil: new Date(now.getTime() - 1),
    });

    await expect(claimWaitlistSlot({ sessionId: 's1', userId: 'u1', now })).rejects.toThrow();
    expect(mocks.db.slotHold.create).not.toHaveBeenCalled();
  });
});

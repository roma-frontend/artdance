import { beforeEach, describe, expect, it, vi } from 'vitest';

import { openDispute, resolveDispute } from '@/server/disputes/service';
import { recordReliabilityEvent } from '@/server/reliability/service';

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    booking: { findUnique: vi.fn() },
    venueMember: { findUnique: vi.fn() },
    dispute: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: dbMock }));
vi.mock('@/server/reliability/service', () => ({ recordReliabilityEvent: vi.fn() }));

const NOW = new Date('2026-06-01T12:00:00Z');
const PAST = new Date('2026-06-01T10:00:00Z');
const FUTURE = new Date('2026-06-01T14:00:00Z');
const REASON = 'Занятие не состоялось: инструктор опоздал на сорок минут.';

const BOOKING = {
  status: 'CONFIRMED',
  endsAt: PAST,
  customerId: 'customer-1',
  venueId: null,
  instructor: { userId: 'instructor-1' },
};

const OPEN_DISPUTE = {
  status: 'PENDING',
  openedBy: 'customer-1',
  booking: { customerId: 'customer-1', instructor: { userId: 'instructor-1' } },
};

beforeEach(() => {
  vi.resetAllMocks();
  dbMock.$transaction.mockImplementation((fn: (tx: typeof dbMock) => Promise<unknown>) => fn(dbMock));
});

describe('openDispute', () => {
  it('rejects a user who is not a participant of the booking', async () => {
    dbMock.booking.findUnique.mockResolvedValueOnce(BOOKING);

    await expect(
      openDispute({ bookingId: 'b-1', reason: REASON, openedBy: 'stranger-1', now: NOW }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(dbMock.dispute.create).not.toHaveBeenCalled();
  });

  it('rejects a venue member who does not belong to the venue', async () => {
    dbMock.booking.findUnique.mockResolvedValueOnce({ ...BOOKING, venueId: 'venue-1', instructor: null });
    dbMock.venueMember.findUnique.mockResolvedValueOnce(null);

    await expect(
      openDispute({ bookingId: 'b-1', reason: REASON, openedBy: 'stranger-1', now: NOW }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(dbMock.dispute.create).not.toHaveBeenCalled();
  });

  it('rejects a dispute on a confirmed lesson that has not ended yet', async () => {
    dbMock.booking.findUnique.mockResolvedValueOnce({ ...BOOKING, endsAt: FUTURE });

    await expect(
      openDispute({ bookingId: 'b-1', reason: REASON, openedBy: 'customer-1', now: NOW }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', field: 'bookingId' });
    expect(dbMock.dispute.create).not.toHaveBeenCalled();
  });

  it('lets a participant open a dispute after the lesson has ended', async () => {
    dbMock.booking.findUnique.mockResolvedValueOnce(BOOKING);
    dbMock.dispute.create.mockResolvedValueOnce({ id: 'd-1', status: 'PENDING' });

    await expect(
      openDispute({ bookingId: 'b-1', reason: REASON, openedBy: 'customer-1', now: NOW }),
    ).resolves.toEqual({ id: 'd-1', status: 'PENDING' });
    expect(dbMock.dispute.create).toHaveBeenCalledWith({
      data: { bookingId: 'b-1', reason: REASON, openedBy: 'customer-1' },
    });
  });

  it('rejects a reason that is too short', async () => {
    await expect(
      openDispute({ bookingId: 'b-1', reason: 'коротко', openedBy: 'customer-1', now: NOW }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', field: 'reason' });
    expect(dbMock.booking.findUnique).not.toHaveBeenCalled();
  });
});

describe('resolveDispute', () => {
  it('penalizes the instructor when the customer, as claimant, wins', async () => {
    dbMock.dispute.findUnique.mockResolvedValueOnce(OPEN_DISPUTE);
    dbMock.dispute.updateMany.mockResolvedValueOnce({ count: 1 });
    dbMock.dispute.findUniqueOrThrow.mockResolvedValueOnce({ id: 'd-1', status: 'APPROVED' });

    await resolveDispute({ disputeId: 'd-1', winner: 'CLAIMANT' });

    expect(dbMock.dispute.updateMany).toHaveBeenCalledWith({
      where: { id: 'd-1', status: 'PENDING' },
      data: { status: 'APPROVED' },
    });
    expect(recordReliabilityEvent).toHaveBeenCalledWith(
      { userId: 'instructor-1', kind: 'DISPUTE_LOST', refId: 'd-1' },
      dbMock,
    );
  });

  it('penalizes the customer when the instructor, as respondent, wins', async () => {
    dbMock.dispute.findUnique.mockResolvedValueOnce(OPEN_DISPUTE);
    dbMock.dispute.updateMany.mockResolvedValueOnce({ count: 1 });
    dbMock.dispute.findUniqueOrThrow.mockResolvedValueOnce({ id: 'd-1', status: 'REJECTED' });

    await resolveDispute({ disputeId: 'd-1', winner: 'RESPONDENT' });

    expect(dbMock.dispute.updateMany).toHaveBeenCalledWith({
      where: { id: 'd-1', status: 'PENDING' },
      data: { status: 'REJECTED' },
    });
    expect(recordReliabilityEvent).toHaveBeenCalledWith(
      { userId: 'customer-1', kind: 'DISPUTE_LOST', refId: 'd-1' },
      dbMock,
    );
  });

  it('penalizes the customer when the instructor opened the dispute and the instructor wins as claimant', async () => {
    dbMock.dispute.findUnique.mockResolvedValueOnce({ ...OPEN_DISPUTE, openedBy: 'instructor-1' });
    dbMock.dispute.updateMany.mockResolvedValueOnce({ count: 1 });
    dbMock.dispute.findUniqueOrThrow.mockResolvedValueOnce({ id: 'd-1', status: 'APPROVED' });

    await resolveDispute({ disputeId: 'd-1', winner: 'CLAIMANT' });

    expect(recordReliabilityEvent).toHaveBeenCalledWith(
      { userId: 'customer-1', kind: 'DISPUTE_LOST', refId: 'd-1' },
      dbMock,
    );
  });

  it('does not decide an already decided dispute', async () => {
    dbMock.dispute.findUnique.mockResolvedValueOnce({ ...OPEN_DISPUTE, status: 'APPROVED' });

    await expect(resolveDispute({ disputeId: 'd-1', winner: 'RESPONDENT' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'status',
    });
    expect(dbMock.dispute.updateMany).not.toHaveBeenCalled();
    expect(recordReliabilityEvent).not.toHaveBeenCalled();
  });

  it('applies no penalty when the compare-and-set loses a race', async () => {
    dbMock.dispute.findUnique.mockResolvedValueOnce(OPEN_DISPUTE);
    dbMock.dispute.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(resolveDispute({ disputeId: 'd-1', winner: 'CLAIMANT' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'status',
    });
    expect(recordReliabilityEvent).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';

import { assertSessionRoomFree } from './room-conflict';

const startsAt = new Date('2026-11-03T14:00:00Z');
const endsAt = new Date('2026-11-03T15:00:00Z');
const session = { roomId: 'room-1', startsAt, endsAt, isCancelled: false };

const makeClient = (bookingHit: unknown = null, sessionHit: unknown = null) => ({
  booking: { findFirst: vi.fn().mockResolvedValue(bookingHit) },
  classSession: { findFirst: vi.fn().mockResolvedValue(sessionHit) },
});

const whereOf = (fn: unknown) => {
  const mock = fn as ReturnType<typeof vi.fn>;
  return (mock.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
};

describe('assertSessionRoomFree', () => {
  it('passes when the room has no overlapping booking or session', async () => {
    const client = makeClient();
    await expect(assertSessionRoomFree(client as never, session)).resolves.toBeUndefined();
  });

  it('skips the check when no room is assigned', async () => {
    const client = makeClient();
    await assertSessionRoomFree(client as never, { ...session, roomId: null });
    expect(client.booking.findFirst).not.toHaveBeenCalled();
    expect(client.classSession.findFirst).not.toHaveBeenCalled();
  });

  it('skips the check for cancelled sessions', async () => {
    const client = makeClient({ id: 'b1' });
    await assertSessionRoomFree(client as never, { ...session, isCancelled: true });
    expect(client.booking.findFirst).not.toHaveBeenCalled();
  });

  it('rejects when a blocking booking overlaps in the same room', async () => {
    const client = makeClient({ id: 'b1' });
    await expect(assertSessionRoomFree(client as never, session)).rejects.toThrow();
  });

  it('rejects when another class session overlaps in the same room', async () => {
    const client = makeClient(null, { id: 's2' });
    await expect(assertSessionRoomFree(client as never, session)).rejects.toThrow();
  });

  it('pads the overlap window by the booking buffer and excludes trashed sessions', async () => {
    const client = makeClient();
    await assertSessionRoomFree(client as never, session);
    const where = whereOf(client.classSession.findFirst);
    expect(where.roomId).toBe('room-1');
    expect(where.deletedAt).toBeNull();
    expect(where.startsAt).toEqual({ lt: new Date(endsAt.getTime() + 15 * 60_000) });
    expect(where.endsAt).toEqual({ gt: new Date(startsAt.getTime() - 15 * 60_000) });
  });

  it('ignores the session being edited and keeps rental bookings (sessionId null)', async () => {
    const client = makeClient();
    await assertSessionRoomFree(client as never, session, 'session-1');
    const bookingWhere = whereOf(client.booking.findFirst);
    const sessionWhere = whereOf(client.classSession.findFirst);
    expect(bookingWhere.OR).toEqual([{ sessionId: null }, { sessionId: { not: 'session-1' } }]);
    expect(sessionWhere.id).toEqual({ not: 'session-1' });
  });
});

/**
 * Назначение зала занятию: владение площадкой, принадлежность зала, конфликты.
 * Бронь и занятие в одном зале не должны совпасть по времени.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { domainErrors } from '@/domain/errors';

const mocks = vi.hoisted(() => ({
  db: {
    classSession: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    room: { findFirst: vi.fn(), findMany: vi.fn() },
    booking: { findFirst: vi.fn() },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
  },
  requireCaller: vi.fn(),
  requireVenueMembership: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/lib/auth/guards', () => ({
  requireCaller: mocks.requireCaller,
  requireVenueMembership: mocks.requireVenueMembership,
}));

import {
  assignClassSessionRoom,
  getActiveVenueRooms,
  getClassSessionRoomAssignment,
  getInstructorUpcomingSessions,
  getVenueUpcomingSessions,
} from './room-assignment';

const startsAt = new Date('2026-06-01T10:00:00Z');
const endsAt = new Date('2026-06-01T11:00:00Z');
const session = {
  id: 'session-1',
  startsAt,
  endsAt,
  isCancelled: false,
  danceClass: { venueId: 'venue-1', instructor: { userId: 'instructor-1' } },
};

describe('assignClassSessionRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.$transaction.mockImplementation(async (fn: (client: typeof mocks.db) => unknown) => fn(mocks.db));
    mocks.db.booking.findFirst.mockResolvedValue(null);
    mocks.db.classSession.update.mockResolvedValue({});
    mocks.db.$executeRaw.mockResolvedValue(0);
    mocks.requireCaller.mockResolvedValue({ id: 'user-1' });
    mocks.requireVenueMembership.mockResolvedValue({ id: 'user-1' });
  });

  it('rejects a session that does not exist or is cancelled', async () => {
    mocks.db.classSession.findFirst.mockResolvedValueOnce(null);

    await expect(assignClassSessionRoom({ sessionId: 'missing', roomId: 'room-1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mocks.requireVenueMembership).not.toHaveBeenCalled();
    expect(mocks.db.classSession.update).not.toHaveBeenCalled();
  });

  it('rejects a session that is not held at any venue', async () => {
    mocks.db.classSession.findFirst.mockResolvedValueOnce({ ...session, danceClass: { venueId: null, instructor: { userId: 'instructor-1' } } });

    await expect(assignClassSessionRoom({ sessionId: 'session-1', roomId: 'room-1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mocks.requireVenueMembership).not.toHaveBeenCalled();
  });

  it('lets the class instructor assign a room without venue membership', async () => {
    mocks.requireCaller.mockResolvedValueOnce({ id: 'instructor-1' });
    mocks.db.classSession.findFirst
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce(null);
    mocks.db.room.findFirst.mockResolvedValueOnce({ id: 'room-1' });

    await assignClassSessionRoom({ sessionId: 'session-1', roomId: 'room-1' });

    expect(mocks.requireVenueMembership).not.toHaveBeenCalled();
    expect(mocks.db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mocks.db.classSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { roomId: 'room-1' },
    });
  });

  it('checks venue membership for the session venue', async () => {
    mocks.db.classSession.findFirst.mockResolvedValueOnce(session);
    mocks.requireVenueMembership.mockRejectedValueOnce(domainErrors.forbidden());

    await expect(assignClassSessionRoom({ sessionId: 'session-1', roomId: 'room-1' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mocks.requireVenueMembership).toHaveBeenCalledWith('venue-1');
    expect(mocks.db.classSession.update).not.toHaveBeenCalled();
  });

  it('rejects a room that belongs to another venue or is inactive', async () => {
    mocks.db.classSession.findFirst.mockResolvedValueOnce(session);
    mocks.db.room.findFirst.mockResolvedValueOnce(null);

    await expect(assignClassSessionRoom({ sessionId: 'session-1', roomId: 'room-foreign' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mocks.db.room.findFirst.mock.calls[0]?.[0]?.where).toEqual({
      id: 'room-foreign',
      venueId: 'venue-1',
      deletedAt: null,
      isActive: true,
    });
    expect(mocks.db.classSession.update).not.toHaveBeenCalled();
  });

  it('rejects a room that is already taken by a booking or another class', async () => {
    mocks.db.classSession.findFirst
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({ id: 'session-2' });
    mocks.db.room.findFirst.mockResolvedValueOnce({ id: 'room-1' });

    await expect(assignClassSessionRoom({ sessionId: 'session-1', roomId: 'room-1' })).rejects.toMatchObject({ code: 'SLOT_CONFLICT' });
    expect(mocks.db.classSession.update).not.toHaveBeenCalled();
  });

  it('assigns the room and excludes the session itself from the conflict check', async () => {
    mocks.db.classSession.findFirst
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce(null);
    mocks.db.room.findFirst.mockResolvedValueOnce({ id: 'room-1' });

    await assignClassSessionRoom({ sessionId: 'session-1', roomId: 'room-1' });

    const conflictWhere = mocks.db.classSession.findFirst.mock.calls[1]?.[0]?.where;
    expect(conflictWhere).toMatchObject({ roomId: 'room-1', isCancelled: false, id: { not: 'session-1' } });
    expect(mocks.db.classSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { roomId: 'room-1' },
    });
  });

  it('clears the room without looking one up or checking conflicts', async () => {
    mocks.db.classSession.findFirst.mockResolvedValueOnce(session);

    await assignClassSessionRoom({ sessionId: 'session-1', roomId: null });

    expect(mocks.db.room.findFirst).not.toHaveBeenCalled();
    expect(mocks.db.classSession.findFirst).toHaveBeenCalledTimes(1);
    expect(mocks.db.classSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { roomId: null },
    });
  });
});

describe('getInstructorUpcomingSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects upcoming sessions of the instructor that are held at a venue', async () => {
    const now = new Date('2026-05-01T10:00:00Z');
    mocks.db.classSession.findMany.mockResolvedValue([]);

    await getInstructorUpcomingSessions('instructor-1', now);

    expect(mocks.db.classSession.findMany.mock.calls[0]?.[0]?.where).toEqual({
      deletedAt: null,
      isCancelled: false,
      startsAt: { gte: now },
      danceClass: { instructorId: 'instructor-1', deletedAt: null, venueId: { not: null } },
    });
  });

  it('drops sessions without a venue and flattens the class title', async () => {
    mocks.db.classSession.findMany.mockResolvedValue([
      { id: 'a', startsAt, endsAt, roomId: null, danceClass: { title: 'No venue', venue: null } },
      { id: 'b', startsAt, endsAt, roomId: 'room-1', danceClass: { title: 'Salsa', venue: { id: 'venue-1', name: 'Studio' } } },
    ]);

    const result = await getInstructorUpcomingSessions('instructor-1');

    expect(result).toEqual([{ id: 'b', startsAt, endsAt, roomId: 'room-1', title: 'Salsa', venue: { id: 'venue-1', name: 'Studio' } }]);
  });
});

describe('getActiveVenueRooms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns no rooms without querying when there are no venues', async () => {
    expect(await getActiveVenueRooms([])).toEqual([]);
    expect(mocks.db.room.findMany).not.toHaveBeenCalled();
  });

  it('selects only active, undeleted rooms of the given venues', async () => {
    mocks.db.room.findMany.mockResolvedValue([]);

    await getActiveVenueRooms(['venue-1', 'venue-2']);

    expect(mocks.db.room.findMany.mock.calls[0]?.[0]?.where).toEqual({
      venueId: { in: ['venue-1', 'venue-2'] },
      deletedAt: null,
      isActive: true,
    });
  });
});

describe('getClassSessionRoomAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCaller.mockResolvedValue({ id: 'instructor-1' });
    mocks.db.room.findMany.mockResolvedValue([{ id: 'room-1', name: 'Main', venueId: 'venue-1' }]);
  });

  it('returns only the assigned session and rooms from its venue', async () => {
    mocks.db.classSession.findFirst.mockResolvedValue({
      id: 'session-1',
      startsAt,
      endsAt,
      roomId: 'room-1',
      danceClass: {
        title: 'Salsa',
        venueId: 'venue-1',
        instructor: { userId: 'instructor-1' },
        venue: { id: 'venue-1', name: 'Studio' },
      },
    });

    const result = await getClassSessionRoomAssignment('session-1');

    expect(result).toEqual({
      session: {
        id: 'session-1',
        title: 'Salsa',
        startsAt,
        endsAt,
        roomId: 'room-1',
        venue: { id: 'venue-1', name: 'Studio' },
      },
      rooms: [{ id: 'room-1', name: 'Main', venueId: 'venue-1' }],
    });
    expect(mocks.db.room.findMany.mock.calls[0]?.[0]?.where).toEqual({
      venueId: { in: ['venue-1'] },
      deletedAt: null,
      isActive: true,
    });
  });
});

describe('getVenueUpcomingSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects only active, upcoming sessions held at the given venue', async () => {
    const now = new Date('2026-05-01T10:00:00Z');
    mocks.db.classSession.findMany.mockResolvedValue([]);

    await getVenueUpcomingSessions('venue-1', now);

    expect(mocks.db.classSession.findMany.mock.calls[0]?.[0]?.where).toEqual({
      deletedAt: null,
      isCancelled: false,
      startsAt: { gte: now },
      danceClass: { venueId: 'venue-1', deletedAt: null },
    });
  });
});

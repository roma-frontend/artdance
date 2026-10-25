import 'server-only';

import { domainErrors } from '@/domain/errors';
import { requireCaller, requireVenueMembership } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { assertSessionRoomFree } from '@/server/booking/room-conflict';

const UPCOMING_SESSION_LIMIT = 50;

/**
 * Ближайшие активные занятия, которые проходят на площадке. Занятия других
 * площадок и инструкторов без площадки сюда не попадают.
 */
export async function getVenueUpcomingSessions(venueId: string, now: Date = new Date()) {
  return db.classSession.findMany({
    where: {
      deletedAt: null,
      isCancelled: false,
      startsAt: { gte: now },
      danceClass: { venueId, deletedAt: null },
    },
    orderBy: { startsAt: 'asc' },
    take: UPCOMING_SESSION_LIMIT,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      roomId: true,
      danceClass: { select: { title: true } },
    },
  });
}

/**
 * Ближайшие занятия инструктора, которые проходят на площадке. Занятия без
 * площадки залов не имеют и сюда не попадают.
 */
export async function getInstructorUpcomingSessions(instructorId: string, now: Date = new Date()) {
  const rows = await db.classSession.findMany({
    where: {
      deletedAt: null,
      isCancelled: false,
      startsAt: { gte: now },
      danceClass: { instructorId, deletedAt: null, venueId: { not: null } },
    },
    orderBy: { startsAt: 'asc' },
    take: UPCOMING_SESSION_LIMIT,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      roomId: true,
      danceClass: { select: { title: true, venue: { select: { id: true, name: true } } } },
    },
  });
  return rows.flatMap(({ danceClass, ...row }) =>
    danceClass.venue ? [{ ...row, title: danceClass.title, venue: danceClass.venue }] : [],
  );
}

/** Активные залы указанных площадок: варианты для выбора в расписании. */
export async function getActiveVenueRooms(venueIds: readonly string[]) {
  if (venueIds.length === 0) return [];
  return db.room.findMany({
    where: { venueId: { in: [...venueIds] }, deletedAt: null, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, venueId: true },
  });
}

/**
 * Назначает занятию зал (или снимает зал при `roomId: null`).
 *
 * Правила:
 * - занятие должно существовать, не быть удалённым и отменённым, и принадлежать площадке;
 * - менять зал может инструктор этого занятия или участник площадки (администратор проходит всегда);
 * - зал должен принадлежать той же площадке, быть активным и не удалённым;
 * - зал не должен пересекаться с бронями и другими занятиями (проверка в транзакции).
 */
export async function assignClassSessionRoom(input: { sessionId: string; roomId: string | null }): Promise<void> {
  const session = await db.classSession.findFirst({
    where: { id: input.sessionId, deletedAt: null, isCancelled: false },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      isCancelled: true,
      danceClass: { select: { venueId: true, instructor: { select: { userId: true } } } },
    },
  });
  const venueId = session?.danceClass.venueId;
  if (!session || !venueId) throw domainErrors.notFound();

  const caller = await requireCaller();
  if (session.danceClass.instructor.userId !== caller.id) await requireVenueMembership(venueId);

  if (input.roomId !== null) {
    const room = await db.room.findFirst({
      where: { id: input.roomId, venueId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!room) throw domainErrors.notFound();
  }

  await db.$transaction(async (tx) => {
    // Без блокировки два параллельных назначения видят один и тот же свободный зал.
    if (input.roomId !== null) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.roomId}))`;
    await assertSessionRoomFree(
      tx,
      { roomId: input.roomId, startsAt: session.startsAt, endsAt: session.endsAt, isCancelled: session.isCancelled },
      session.id,
    );
    await tx.classSession.update({ where: { id: session.id }, data: { roomId: input.roomId } });
  });
}

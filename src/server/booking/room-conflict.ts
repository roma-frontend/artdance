import { booking } from '@/config/business';
import { slotBlockingBookingStatuses } from '@/domain/enums';
import { domainErrors } from '@/domain/errors';
import { notTrashed } from '@/domain/trash';

type FindFirst = (args: { where: object; select: { id: true } }) => PromiseLike<unknown>;
type RoomConflictClient = { booking: { findFirst: FindFirst }; classSession: { findFirst: FindFirst } };

/**
 * Зал не может быть занят двумя занятиями или занятием и арендой одновременно.
 * `excludeSessionId` нужен при правке занятия: его собственные брони не конфликтуют.
 * Занятия без зала и отменённые не проверяются.
 */
export async function assertSessionRoomFree(
  client: RoomConflictClient,
  session: { roomId: unknown; startsAt: unknown; endsAt: unknown; isCancelled: unknown },
  excludeSessionId?: string,
): Promise<void> {
  if (typeof session.roomId !== 'string' || session.isCancelled === true) return;
  if (!(session.startsAt instanceof Date) || !(session.endsAt instanceof Date)) return;

  const { startsAt, endsAt } = session;
  const bufMs = booking.bufferBetweenBookingsMinutes * 60_000;
  const overlap = {
    startsAt: { lt: new Date(endsAt.getTime() + bufMs) },
    endsAt: { gt: new Date(startsAt.getTime() - bufMs) },
  };
  const otherSession = excludeSessionId
    ? { OR: [{ sessionId: null }, { sessionId: { not: excludeSessionId } }] }
    : {};

  const bookingClash = await client.booking.findFirst({
    where: { roomId: session.roomId, status: { in: [...slotBlockingBookingStatuses] }, ...overlap, ...otherSession },
    select: { id: true },
  });
  if (bookingClash) throw domainErrors.slotConflict();

  const sessionClash = await client.classSession.findFirst({
    where: {
      roomId: session.roomId,
      ...notTrashed,
      isCancelled: false,
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
      ...overlap,
    },
    select: { id: true },
  });
  if (sessionClash) throw domainErrors.slotConflict();
}

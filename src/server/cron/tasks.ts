import 'server-only';

import { booking } from '@/config/business';
import { db } from '@/lib/db';
import { purgeExpiredHolds } from '@/server/hold/service';
import { notifyBookingReminder, notifyWaitlistReady } from '@/server/booking/notify';

export interface CronReport {
  purgedHolds: number;
  autoCompleted: number;
  remindersSent: number;
  waitlistExpired: number;
}

export async function runBookingCron(now: Date): Promise<CronReport> {
  const purged = await purgeExpiredHolds(now);

  // Автозавершение: CONFIRMED брони, где endsAt + autoCompleteAfterHours <= now.
  // Делаем одним запросом по cutoff, а не выборкой + фильтром в памяти.
  const autoCompleteCutoff = new Date(now.getTime() - booking.autoCompleteAfterHours * 60 * 60 * 1000);
  const toComplete = await db.booking.findMany({
    where: {
      status: 'CONFIRMED' as never,
      endsAt: { lte: autoCompleteCutoff },
    } as never,
    select: { id: true },
  });
  let autoCompleted = 0;
  if (toComplete.length > 0) {
    const res = await db.booking.updateMany({
      where: { id: { in: toComplete.map((b) => b.id) } } as never,
      data: { status: 'COMPLETED', completedAt: now } as never,
    });
    autoCompleted = res.count;
  }

  // Напоминания: брони CONFIRMED с startsAt в окнах 24ч и 2ч (±15 мин) без уже отправленного reminder
  let remindersSent = 0;
  for (const hours of booking.reminderOffsetsHours) {
    const targetMs = now.getTime() + hours * 60 * 60 * 1000;
    const windowMs = 15 * 60 * 1000;
    const bookings = await db.booking.findMany({
      where: {
        status: 'CONFIRMED',
        startsAt: { gte: new Date(targetMs - windowMs), lte: new Date(targetMs + windowMs) },
      } as never,
      select: { id: true, startsAt: true },
    });
    for (const b of bookings) {
      // дедупликация внутри notify по dedupeKey
      try {
        await notifyBookingReminder(b.id, hours);
        remindersSent += 1;
      } catch {
        // best effort
      }
    }
  }

  // Истёкшие claim окна листа ожидания — вернуть позицию в очередь (сбросить notifiedAt/claimUntil, чтобы следующий получил шанс)
  const expiredWaitlist = await db.waitlistEntry.findMany({
    where: { notifiedAt: { not: null }, claimUntil: { lte: now } } as never,
    select: { id: true, sessionId: true },
  });
  let waitlistExpired = 0;
  for (const entry of expiredWaitlist) {
    await db.waitlistEntry.delete({ where: { id: entry.id } }).catch(() => {});
    waitlistExpired += 1;
    // отдать место следующему в очереди
    const next = await db.waitlistEntry.findFirst({
      where: { sessionId: entry.sessionId, notifiedAt: null } as never,
      orderBy: { position: 'asc' } as never,
      select: { id: true, userId: true },
    });
    if (next) {
      const claimUntil = new Date(now.getTime() + booking.waitlistClaimWindowMinutes * 60 * 1000);
      await db.waitlistEntry.update({ where: { id: next.id }, data: { notifiedAt: now, claimUntil } as never });
      await notifyWaitlistReady(entry.sessionId, (next as unknown as { userId: string }).userId, claimUntil).catch(() => {});
      // перенумеровать
      const rest = await db.waitlistEntry.findMany({
        where: { sessionId: entry.sessionId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      for (const [i, row] of rest.entries()) {
        await db.waitlistEntry.update({ where: { id: row.id }, data: { position: i + 1 } as never });
      }
    }
  }

  return { purgedHolds: purged.purged, autoCompleted, remindersSent, waitlistExpired };
}

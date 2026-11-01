import 'server-only';

import { booking } from '@/config/business';
import { db } from '@/lib/db';
import { notifyWaitlistReady } from '@/server/booking/notify';

/**
 * Место освободилось — предлагаем его первому в листе ожидания.
 *
 * Отмену клиентом обрабатывает `cancelBooking`, а истёкшие окна удержания — cron.
 * Остальные пути (отмена администратором, истечение неоплаченных броней, отклонение
 * и истечение заявок) место раньше не отдавали: ожидающие о нём не узнавали. Вызывать
 * после того, как `bookedCount` уже уменьшен.
 */
export async function offerFreedSeat(sessionId: string, now: Date): Promise<void> {
  try {
    const session = await db.classSession.findUnique({
      where: { id: sessionId },
      select: { capacity: true, bookedCount: true, isCancelled: true },
    });
    if (!session || session.isCancelled || session.bookedCount >= session.capacity) return;

    const next = await db.waitlistEntry.findFirst({
      where: { sessionId, notifiedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true, userId: true },
    });
    if (!next) return;

    const claimUntil = new Date(now.getTime() + booking.waitlistClaimWindowMinutes * 60_000);
    await db.waitlistEntry.update({ where: { id: next.id }, data: { notifiedAt: now, claimUntil } });
    await notifyWaitlistReady(sessionId, next.userId, claimUntil);
  } catch (error) {
    // Письмо или база не должны сорвать отмену, которая уже зафиксирована.
    console.error('[waitlist] место не предложено', { sessionId, error });
  }
}

/** Окно удержания места для пользователя, если оно ещё открыто. */
export async function activeWaitlistClaim(
  sessionId: string,
  userId: string,
  now: Date,
): Promise<{ claimUntil: Date } | null> {
  const entry = await db.waitlistEntry.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
    select: { notifiedAt: true, claimUntil: true },
  });
  if (!entry?.notifiedAt || !entry.claimUntil) return null;
  if (entry.claimUntil.getTime() <= now.getTime()) return null;
  return { claimUntil: entry.claimUntil };
}

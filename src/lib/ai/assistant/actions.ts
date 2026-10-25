/**
 * Действия из ответа ассистента. Сейчас одно: предложить запись на занятие.
 *
 * ID из ответа модели не доверяем: каждую сессию перепроверяем в базе по тем же
 * условиям, что и публичное расписание. Занятие, которое отменили, прошло или
 * где нет мест, в действие не попадает.
 */
import type { Locale } from '@/i18n/config';
import { db } from '@/lib/db';
import { pickTitle } from '@/lib/ai/assistant/knowledge';
import { notTrashed } from '@/domain/trash';
import { publicClassWhere } from '@/server/queries/classes';

export interface BookSessionAction {
  type: 'book';
  sessionId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  spotsLeft: number;
}

export type AssistantAction = BookSessionAction;

export async function resolveBookingActions(
  sessionIds: readonly string[],
  locale: Locale,
  now: Date,
): Promise<AssistantAction[]> {
  if (sessionIds.length === 0) return [];

  const rows = await db.classSession.findMany({
    where: {
      ...notTrashed,
      id: { in: [...sessionIds] },
      isCancelled: false,
      startsAt: { gt: now },
      danceClass: { ...notTrashed, ...publicClassWhere },
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      bookedCount: true,
      danceClass: { select: { title: true, translations: { select: { locale: true, title: true } } } },
    },
  });

  const byId = new Map(rows.map((row) => [row.id, row]));

  const actions: AssistantAction[] = [];
  for (const id of sessionIds) {
    const row = byId.get(id);
    if (!row) continue;

    const spotsLeft = row.capacity - row.bookedCount;
    if (spotsLeft <= 0) continue;

    actions.push({
      type: 'book',
      sessionId: row.id,
      title: pickTitle(row.danceClass.title, row.danceClass.translations, locale),
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      spotsLeft,
    });
  }
  return actions;
}

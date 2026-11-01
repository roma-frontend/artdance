import 'server-only';

import type { ClassCardItem } from '@/domain/content';
import { db } from '@/lib/db';
import { classCardsBy } from '@/server/queries/classes';

export const forYouLimit = 6;

/**
 * «Для тебя» — занятия по направлениям из анкеты танцора.
 *
 * Берём только то, что человек сам указал в анкете (`DancerProfile.styles`), и только
 * опубликованные занятия с ближайшим расписанием — через `classCardsBy`, который
 * добавляет публичность. Без анкеты (или без направлений) подборки нет: выдумывать
 * вкус по поведению здесь не из чего, а ошибочная подборка хуже пустой.
 */
export async function forYouClasses(userId: string): Promise<readonly ClassCardItem[]> {
  const profile = await db.dancerProfile.findUnique({
    where: { userId },
    select: { onboardingCompleted: true, styles: true },
  });
  if (!profile?.onboardingCompleted || profile.styles.length === 0) return [];

  return classCardsBy({ style: { in: profile.styles } }, forYouLimit);
}

/**
 * АНКЕТА ТАНЦОРА — чтение и запись профиля для веба и мобильного приложения.
 *
 * Одна точка записи: и server action веба, и API для мобильного приложения
 * сохраняют через эти функции, чтобы правила `emptyToNull` и `upsert` по
 * `userId` не разошлись между клиентами.
 *
 * Личность передаёт вызывающий код из сессии. Сервис не принимает `userId`
 * из запроса.
 */

import { emptyToNull, type DancerOnboardingInput } from '@/domain/dancer-profile';
import { db } from '@/lib/db';

/** Профиль танцора текущего пользователя или `null`, если анкеты ещё нет. */
export async function getDancerProfile(userId: string) {
  return db.dancerProfile.findUnique({
    where: { userId },
    select: { level: true, styles: true, goal: true, note: true, onboardingCompleted: true },
  });
}

/**
 * Сохранить ответы шага тура. Профиль у человека один, поэтому `upsert` по
 * `userId`: повторная отправка не падает на «такой профиль уже есть».
 */
export async function saveDancerProfile(userId: string, input: DancerOnboardingInput): Promise<{ id: string }> {
  const data = {
    level: input.level,
    styles: input.styles,
    goal: emptyToNull(input.goal),
    note: emptyToNull(input.note),
    onboardingCompleted: input.completed,
  };

  return db.dancerProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
    select: { id: true },
  });
}

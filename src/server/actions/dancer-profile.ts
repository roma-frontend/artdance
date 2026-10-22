'use server';

/**
 * АНКЕТА ТАНЦОРА — сохранение ответов онбординга.
 *
 * Одно действие на все шаги, потому что разница между шагами — только в том,
 * какие поля заполнены, а не в том, кто и что сохраняет. Отдельное действие на
 * каждый шаг означало бы три копии проверки прав и три места, где можно
 * забыть `requireCaller`.
 *
 * **Идентичность берётся из сессии.** `userId` в аргументах не принимается:
 * действие — публичный HTTP-эндпоинт, и подставленный `userId` записал бы
 * анкету чужому человеку.
 *
 * **Запись идемпотентна по `userId`.** Профиль у человека один, поэтому
 * `upsert` по `userId`, а не `create`: повторная отправка финального шага не
 * должна падать на «такой профиль уже есть».
 *
 * **Уровень обязателен, остальное — нет.** Стили и цель можно не заполнять;
 * запрещать из-за них сохранение значило бы заставлять человека отвечать на
 * вопросы, которые ему неинтересны, только ради того, чтобы он попал в базу.
 */

import { dancerOnboardingSchema, emptyToNull } from '@/domain/dancer-profile';
import { db } from '@/lib/db';
import { authedAction } from '@/server/safe-action';

/**
 * Сохранить ответы анкеты.
 *
 * `completed` помечает, что человек дошёл до конца тура: пока флаг не
 * установлен, его можно позвать в тур снова — при этом прежние ответы
 * остаются и подставляются в формы.
 */
export const saveDancerProfileAction = authedAction
  .metadata({ rateLimit: 'dancerProfile', audit: 'dancerProfile.update' })
  .inputSchema(dancerOnboardingSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { caller } = ctx;

    const profile = await db.dancerProfile.upsert({
      where: { userId: caller.id },
      create: {
        userId: caller.id,
        level: parsedInput.level,
        styles: parsedInput.styles,
        goal: emptyToNull(parsedInput.goal),
        note: emptyToNull(parsedInput.note),
        onboardingCompleted: parsedInput.completed,
      },
      update: {
        level: parsedInput.level,
        styles: parsedInput.styles,
        goal: emptyToNull(parsedInput.goal),
        note: emptyToNull(parsedInput.note),
        onboardingCompleted: parsedInput.completed,
      },
      select: { id: true },
    });

    return { id: profile.id };
  });

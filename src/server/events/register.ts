/**
 * Регистрация на соревнование. Общая логика для веб-действия `submitCompetitionRegistration`
 * и мобильного маршрута `POST /api/events/[slug]/register`.
 *
 * Модуль не объявляет `'use server'`: это обычная серверная функция, которую вызывают
 * и действие, и route handler. Доступ (entitlement, авторизация, лимиты) проверяет вызывающий код.
 */

import { ageFitsCategory, registrationIsOpen } from '@/domain/competition';
import { db } from '@/lib/db';

export type CompetitionRegistrationFailure =
  | 'REGISTRATION_CLOSED'
  | 'CATEGORY_NOT_FOUND'
  | 'AGE_NOT_ELIGIBLE'
  | 'ALREADY_REGISTERED'
  | 'CATEGORY_FULL';

/** Доменная ошибка с кодом. Вызывающий код сам решает, какой текст и статус отдать. */
export class CompetitionRegistrationError extends Error {
  readonly code: CompetitionRegistrationFailure;

  constructor(code: CompetitionRegistrationFailure) {
    super(code);
    this.name = 'CompetitionRegistrationError';
    this.code = code;
  }
}

export interface CompetitionRegistrationInput {
  userId: string;
  eventSlug: string;
  categoryId: string;
  birthDate: Date;
  partnerName: string | null;
  now?: Date;
}

/** Дата рождения в формате `YYYY-MM-DD` (UTC полночь). Null, если дата не распознана или в будущем. */
export function parseBirthDate(value: string, now: Date = new Date()): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date > now) return null;
  return date;
}

/**
 * Создаёт или обновляет заявку в статусе PENDING. Повторная заявка после отмены
 * переиспользует ту же строку. Все проверки идут в одной транзакции.
 */
export async function registerForCompetition(input: CompetitionRegistrationInput): Promise<{ id: string }> {
  const now = input.now ?? new Date();

  return db.$transaction(async (tx) => {
    const event = await tx.event.findFirst({
      where: { slug: input.eventSlug, isPublished: true, type: 'COMPETITION' },
      select: {
        id: true,
        startsAt: true,
        registrationOpenAt: true,
        registrationCloseAt: true,
      },
    });
    if (!event || !registrationIsOpen(now, { openAt: event.registrationOpenAt, closeAt: event.registrationCloseAt })) {
      throw new CompetitionRegistrationError('REGISTRATION_CLOSED');
    }

    const category = await tx.competitionCategory.findFirst({
      where: { id: input.categoryId, eventId: event.id, isActive: true },
      select: { id: true, minAge: true, maxAge: true, maxEntries: true },
    });
    if (!category) throw new CompetitionRegistrationError('CATEGORY_NOT_FOUND');
    if (!ageFitsCategory(input.birthDate, event.startsAt, category)) {
      throw new CompetitionRegistrationError('AGE_NOT_ELIGIBLE');
    }

    const athlete = await tx.athleteProfile.upsert({
      where: { userId: input.userId },
      create: { userId: input.userId, birthDate: input.birthDate },
      update: { birthDate: input.birthDate },
      select: { id: true },
    });
    await tx.user.update({ where: { id: input.userId }, data: { role: 'ATHLETE' } });

    const existing = await tx.competitionRegistration.findUnique({
      where: {
        eventId_categoryId_athleteProfileId: {
          eventId: event.id,
          categoryId: category.id,
          athleteProfileId: athlete.id,
        },
      },
      select: { status: true },
    });
    if (existing && existing.status !== 'CANCELLED') throw new CompetitionRegistrationError('ALREADY_REGISTERED');

    if (category.maxEntries !== null) {
      const occupied = await tx.competitionRegistration.count({
        where: { categoryId: category.id, status: { in: ['PENDING', 'APPROVED'] } },
      });
      if (occupied >= category.maxEntries) throw new CompetitionRegistrationError('CATEGORY_FULL');
    }

    const data = {
      eventId: event.id,
      categoryId: category.id,
      athleteProfileId: athlete.id,
      partnerName: input.partnerName || null,
      status: 'PENDING' as const,
    };

    if (existing) {
      return tx.competitionRegistration.update({
        where: {
          eventId_categoryId_athleteProfileId: {
            eventId: event.id,
            categoryId: category.id,
            athleteProfileId: athlete.id,
          },
        },
        data,
        select: { id: true },
      });
    }
    return tx.competitionRegistration.create({ data, select: { id: true } });
  });
}

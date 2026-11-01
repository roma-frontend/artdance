import 'server-only';

/**
 * РЕЗУЛЬТАТЫ СОРЕВНОВАНИЙ (DS-04) — запись места админом, рейтинг и достижения атлета.
 *
 * Место записывается только по утверждённой регистрации и только после начала
 * соревнования: до него результата нет. Рейтинг считается из тех же строк, что и
 * список достижений, поэтому они не расходятся.
 */

import { athleteRating, competitionPlaces, type CompetitionPlace } from '@/domain/athlete-rating';
import { domainErrors } from '@/domain/errors';
import { db } from '@/lib/db';

export async function recordCompetitionResult(
  input: { registrationId: string; place: CompetitionPlace; recordedById: string },
  now = new Date(),
) {
  if (!(competitionPlaces as readonly string[]).includes(input.place)) throw domainErrors.validationFailed('place');

  const registration = await db.competitionRegistration.findUnique({
    where: { id: input.registrationId },
    select: { status: true, event: { select: { startsAt: true } } },
  });
  if (!registration) throw domainErrors.notFound();
  if (registration.status !== 'APPROVED') throw domainErrors.validationFailed('status');
  if (registration.event.startsAt.getTime() > now.getTime()) throw domainErrors.validationFailed('event');

  return db.competitionResult.upsert({
    where: { registrationId: input.registrationId },
    create: { registrationId: input.registrationId, place: input.place, recordedById: input.recordedById },
    update: { place: input.place, recordedById: input.recordedById },
    select: { id: true, place: true },
  });
}

/** Рейтинг атлета и список его достижений, новые сверху. */
export async function athleteResultsFor(athleteProfileId: string, now = new Date()) {
  const rows = await db.competitionResult.findMany({
    where: { registration: { athleteProfileId } },
    orderBy: { registration: { event: { startsAt: 'desc' } } },
    take: 100,
    select: {
      place: true,
      registration: {
        select: {
          event: { select: { title: true, slug: true, startsAt: true } },
          category: { select: { name: true } },
        },
      },
    },
  });

  const rating = athleteRating(
    rows.map((row) => ({ place: row.place, eventStartsAt: row.registration.event.startsAt })),
    now,
  );
  const achievements = rows.map((row) => ({
    place: row.place,
    eventTitle: row.registration.event.title,
    eventSlug: row.registration.event.slug,
    eventStartsAt: row.registration.event.startsAt,
    categoryName: row.registration.category.name,
  }));
  return { rating, achievements };
}

/** Утверждённые регистрации на прошедшие соревнования, у которых ещё нет места. */
export async function registrationsAwaitingResult(now = new Date(), limit = 200) {
  const rows = await db.competitionRegistration.findMany({
    where: { status: 'APPROVED', result: { is: null }, event: { startsAt: { lte: now } } },
    orderBy: { event: { startsAt: 'desc' } },
    take: limit,
    select: {
      id: true,
      event: { select: { title: true, startsAt: true } },
      category: { select: { name: true } },
      athleteProfile: { select: { user: { select: { name: true } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    eventTitle: row.event.title,
    categoryName: row.category.name,
    athleteName: row.athleteProfile.user.name,
  }));
}

/** Последние записанные места для таблицы в админке. */
export async function recentCompetitionResults(limit = 50) {
  const rows = await db.competitionResult.findMany({
    orderBy: { recordedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      place: true,
      recordedAt: true,
      registration: {
        select: {
          event: { select: { title: true, startsAt: true } },
          category: { select: { name: true } },
          athleteProfile: { select: { user: { select: { name: true } } } },
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    place: row.place,
    recordedAt: row.recordedAt,
    eventTitle: row.registration.event.title,
    eventStartsAt: row.registration.event.startsAt,
    categoryName: row.registration.category.name,
    athleteName: row.registration.athleteProfile.user.name,
  }));
}

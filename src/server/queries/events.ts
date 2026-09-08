/**
 * СОБЫТИЯ ИЗ БАЗЫ: воркшопы, батлы, мастер-классы.
 *
 * ## Прошедшее не показывается
 *
 * Афиша отвечает на вопрос «куда пойти», а не «что было». Условие
 * `endsAt >= now` — по окончанию, а не по началу: событие, которое идёт сейчас,
 * ещё актуально, и убирать его из афиши в момент старта было бы неверно.
 *
 * ## Дата приходит из базы целиком
 *
 * На фикстурах год подставлялся от текущей даты (`MM-DD`), чтобы демо-афиша не
 * «истекала». В базе дата полная, и подстановки больше нет — если событие
 * прошло, оно прошло. Сид пересчитывает демо-события на ближайший год сам.
 */

import 'server-only';

import { limits } from '@/config/business';
import { cacheTags, dataRevalidate } from '@/config/cache';
import {
  availableSorts,
  matchesQuery,
  paginate,
  sortByOption,
  type CatalogQuery,
  type CatalogSort,
} from '@/domain/catalog';
import type { CatalogPage, EventCardItem, EventDetail } from '@/domain/content';
import type { EventType } from '@/domain/enums';
import type { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { formatClock } from '@/lib/time/clock';
import { zonedParts } from '@/lib/time/schedule';
import { defineQuery } from '@/server/query';

import { firstMediaRef, mediaSelect, type MediaRow } from './media';

const eventSelect = {
  slug: true,
  type: true,
  title: true,
  description: true,
  locationName: true,
  startsAt: true,
  endsAt: true,
  price: true,
  capacity: true,
  bookedCount: true,
  createdAt: true,
  media: { select: mediaSelect },
  venue: {
    select: { slug: true, name: true, district: true, latitude: true, longitude: true },
  },
} as const;

interface EventRow {
  slug: string;
  type: EventType;
  title: string;
  description: string;
  locationName: string | null;
  startsAt: Date;
  endsAt: Date;
  price: number;
  capacity: number;
  bookedCount: number;
  createdAt: Date;
  media: MediaRow[];
  venue: {
    slug: string;
    name: string;
    district: string;
    latitude: number;
    longitude: number;
  } | null;
}

/** Опубликованные и ещё не закончившиеся. */
function publicEventWhere(now: Date) {
  return { isPublished: true, endsAt: { gte: now } };
}

export function toEventCard(row: EventRow): EventCardItem {
  const start = zonedParts(row.startsAt);
  const end = zonedParts(row.endsAt);

  return {
    slug: row.slug,
    title: row.title,
    type: row.type,
    startsAt: row.startsAt.toISOString(),
    startTime: formatClock(start.minutesOfDay),
    endTime: formatClock(end.minutesOfDay),
    /**
     * Площадка платформы или внешнее место: у батла на площади площадки в
     * каталоге нет, и пустая строка честнее выдуманного адреса.
     */
    locationName: row.venue?.name ?? row.locationName ?? '',
    price: row.price,
    spotsLeft: Math.max(0, row.capacity - row.bookedCount),
    image: firstMediaRef(row.media) ?? { key: '', alt: { hy: '', ru: '', en: '' } },
  };
}

/**
 * Карточки событий по условию: нужны странице площадки («афиша этого зала»).
 *
 * Публичность добавляется здесь, чтобы соседний модуль не мог показать
 * неопубликованное событие.
 */
export async function eventCardsBy(
  where: Prisma.EventWhereInput,
  take: number,
): Promise<readonly EventCardItem[]> {
  const rows = (await db.event.findMany({
    where: { ...publicEventWhere(new Date()), ...where },
    select: eventSelect,
    orderBy: { startsAt: 'asc' },
    take,
  })) as unknown as EventRow[];

  return rows.map(toEventCard);
}

function eventWhere(query: CatalogQuery, now: Date) {
  return {
    ...publicEventWhere(now),
    ...(query.district ? { venue: { district: query.district } } : {}),
    ...(query.priceMin !== undefined || query.priceMax !== undefined
      ? {
          price: {
            ...(query.priceMin !== undefined ? { gte: query.priceMin } : {}),
            ...(query.priceMax !== undefined ? { lte: query.priceMax } : {}),
          },
        }
      : {}),
  };
}

/** Дата события в поясе бизнеса, `YYYY-MM-DD`: сравнивается с фильтром из URL. */
function isoDateOf(instant: Date): string {
  const parts = zonedParts(instant);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function matchesText(row: EventRow, term: string | undefined): boolean {
  return matchesQuery(term, [
    row.title,
    row.description,
    row.locationName ?? undefined,
    row.venue?.name,
  ]);
}

function eventSortKeys() {
  return {
    /** Ближайшее сначала: афиша без этого порядка бесполезна. */
    relevance: (row: EventRow) => row.startsAt.getTime(),
    price: (row: EventRow) => row.price,
    startsAt: (row: EventRow) => row.startsAt.getTime(),
    createdAt: (row: EventRow) => row.createdAt.getTime(),
  };
}

export const eventSortOptions: readonly CatalogSort[] = availableSorts(eventSortKeys());

export const getEventList = defineQuery({
  name: 'eventList',
  tags: () => [cacheTags.events()],
  revalidate: dataRevalidate.catalog,
  handler: async (query: CatalogQuery): Promise<CatalogPage<EventCardItem>> => {
    const now = new Date();

    const rows = (await db.event.findMany({
      where: eventWhere(query, now),
      select: eventSelect,
      take: limits.query.maxRows,
    })) as unknown as EventRow[];

    const filtered = rows
      .filter((row) => matchesText(row, query.q))
      .filter((row) => !query.date || isoDateOf(row.startsAt) === query.date);

    const sorted = sortByOption(filtered, query.sort, eventSortKeys());
    const page = paginate(sorted, query.page, query.pageSize);

    return { ...page, items: page.items.map(toEventCard) };
  },
});

export const getEventDetail = defineQuery({
  name: 'eventDetail',
  tags: (slug: string) => [cacheTags.event(slug), cacheTags.events()],
  revalidate: dataRevalidate.entity,
  handler: async (slug: string): Promise<EventDetail | null> => {
    /*
     * Прошедшее событие открывается по прямой ссылке: страница уже
     * проиндексирована и может быть в чьём-то календаре, и 404 вместо неё — это
     * потерянный контекст. Из афиши оно при этом ушло.
     */
    const row = (await db.event.findFirst({
      where: { slug, isPublished: true },
      select: eventSelect,
    })) as unknown as EventRow | null;

    if (!row) return null;

    return {
      ...toEventCard(row),
      description: row.description,
      capacity: row.capacity,
      ...(row.venue
        ? {
            venueSlug: row.venue.slug,
            venueDistrict: row.venue.district,
            latitude: row.venue.latitude,
            longitude: row.venue.longitude,
          }
        : {}),
    };
  },
});

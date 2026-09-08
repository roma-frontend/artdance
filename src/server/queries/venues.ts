/**
 * ПЛОЩАДКИ ИЗ БАЗЫ.
 *
 * ## Площадка и зал — разные вещи, и цена живёт у зала
 *
 * Арендуют не студию, а зал в ней: у зала своя площадь, вместимость и ставка за
 * час. В карточке площадки показывается минимальная ставка её залов — «от
 * 8 000 ֏», а не средняя: средняя ставка приводит к экрану, где нет ни одного
 * зала по этой цене.
 *
 * В демо-данных у каждой площадки один зал (в макете одна площадь и одна
 * вместимость), поэтому «минимальная» и «единственная» совпадают. Код рассчитан
 * на несколько залов, потому что реальные студии так и устроены.
 *
 * ## Направление у зала — это направление его занятий
 *
 * Своего списка направлений у площадки нет и быть не может: в одном зале в
 * понедельник сальса, в среду балет. Но выбирать зал под сальсу осмысленно,
 * поэтому фильтр по направлению работает через занятия.
 */

import 'server-only';

import { limits } from '@/config/business';
import { cacheTags, dataRevalidate } from '@/config/cache';
import {
  availableSorts,
  buildFacets,
  matchesQuery,
  paginate,
  sortByOption,
  type CatalogQuery,
  type CatalogSort,
} from '@/domain/catalog';
import type { CatalogPage, FacetOption, VenueCardItem, VenueDetail } from '@/domain/content';
import { danceStyleFromSlug } from '@/domain/enums';
import { db } from '@/lib/db';
import { defineQuery } from '@/server/query';

import { classCardsBy } from './classes';
import { eventCardsBy } from './events';
import { firstMediaRef, mediaSelect, type MediaRow } from './media';
import { approvedReviewsWhere, ratingFrom, reviewSelect, type ReviewRow } from './reviews';

const publicVenueWhere = {
  moderation: 'APPROVED' as const,
  publishedAt: { not: null },
};

const venueSelect = {
  slug: true,
  name: true,
  description: true,
  district: true,
  amenities: true,
  latitude: true,
  longitude: true,
  ratingAverage: true,
  ratingCount: true,
  createdAt: true,
  media: { select: mediaSelect },
  rooms: {
    where: { isActive: true },
    select: { areaSqm: true, capacity: true, pricePerHour: true, amenities: true },
  },
} as const;

interface RoomRow {
  areaSqm: number | null;
  capacity: number;
  pricePerHour: number;
  amenities: string[];
}

interface VenueRow {
  slug: string;
  name: string;
  description: string;
  district: string;
  amenities: string[];
  latitude: number;
  longitude: number;
  ratingAverage: unknown;
  ratingCount: number;
  createdAt: Date;
  media: MediaRow[];
  rooms: RoomRow[];
}

function ratingNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/** Минимальная ставка залов. Ноль означает «залов нет», а не «бесплатно». */
function priceFrom(rooms: readonly RoomRow[]): number {
  return rooms.length > 0 ? Math.min(...rooms.map((room) => room.pricePerHour)) : 0;
}

/**
 * Удобства площадки — объединение удобств её залов и своих.
 *
 * Душ и парковка принадлежат зданию, зеркала и звук — залу; человек, выбирающий
 * место, не различает эти уровни, ему нужен один список.
 */
function amenitiesOf(row: VenueRow): readonly string[] {
  return [...new Set([...row.amenities, ...row.rooms.flatMap((room) => room.amenities)])];
}

export function toVenueCard(row: VenueRow): VenueCardItem {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    district: row.district,
    amenities: amenitiesOf(row),
    pricePerHour: priceFrom(row.rooms),
    ratingAverage: ratingNumber(row.ratingAverage),
    ratingCount: row.ratingCount,
    image: firstMediaRef(row.media) ?? { key: '', alt: { hy: '', ru: '', en: '' } },
  };
}

function venueWhere(query: CatalogQuery) {
  const style = query.style ? danceStyleFromSlug(query.style) ?? undefined : undefined;

  return {
    ...publicVenueWhere,
    ...(query.district ? { district: query.district } : {}),
    ...(style ? { classes: { some: { style, isActive: true } } } : {}),
    /*
     * Цена фильтруется по залам: условие на площадку целиком было бы неверным —
     * студия с дешёвым и дорогим залом подходит обоим концам диапазона.
     */
    ...(query.priceMin !== undefined || query.priceMax !== undefined
      ? {
          rooms: {
            some: {
              isActive: true,
              pricePerHour: {
                ...(query.priceMin !== undefined ? { gte: query.priceMin } : {}),
                ...(query.priceMax !== undefined ? { lte: query.priceMax } : {}),
              },
            },
          },
        }
      : {}),
  };
}

function matchesText(row: VenueRow, term: string | undefined): boolean {
  return matchesQuery(term, [row.name, row.description, row.district, ...amenitiesOf(row)]);
}

function venueSortKeys() {
  return {
    /** Без истории броней лучший общий порядок — по оценке. */
    relevance: (row: VenueRow) => -ratingNumber(row.ratingAverage),
    price: (row: VenueRow) => priceFrom(row.rooms),
    rating: (row: VenueRow) => ratingNumber(row.ratingAverage),
    createdAt: (row: VenueRow) => row.createdAt.getTime(),
  };
}

export const venueSortOptions: readonly CatalogSort[] = availableSorts(venueSortKeys());

export const getVenueList = defineQuery({
  name: 'venueList',
  tags: () => [cacheTags.venues()],
  revalidate: dataRevalidate.catalog,
  handler: async (query: CatalogQuery): Promise<CatalogPage<VenueCardItem>> => {
    const rows = (await db.venue.findMany({
      where: venueWhere(query),
      select: venueSelect,
      take: limits.query.maxRows,
    })) as unknown as VenueRow[];

    const filtered = rows.filter((row) => matchesText(row, query.q));
    const sorted = sortByOption(filtered, query.sort, venueSortKeys());
    const page = paginate(sorted, query.page, query.pageSize);

    return { ...page, items: page.items.map(toVenueCard) };
  },
});

export const getVenueDetail = defineQuery({
  name: 'venueDetail',
  tags: (slug: string) => [cacheTags.venue(slug), cacheTags.venues()],
  revalidate: dataRevalidate.entity,
  handler: async (slug: string): Promise<VenueDetail | null> => {
    const row = (await db.venue.findFirst({
      where: { slug, ...publicVenueWhere },
      select: {
        ...venueSelect,
        reviews: {
          where: approvedReviewsWhere,
          orderBy: { createdAt: 'desc' },
          take: limits.pagination.reviewsPerPage,
          select: reviewSelect,
        },
      },
    })) as unknown as (VenueRow & { reviews: ReviewRow[] }) | null;

    if (!row) return null;

    const { rating, items: reviews } = ratingFrom(row.reviews, {
      average: ratingNumber(row.ratingAverage),
      count: row.ratingCount,
    });

    /* Площадь и вместимость — самого большого зала: он определяет, что здесь возможно. */
    const largest = [...row.rooms].sort((left, right) => right.capacity - left.capacity)[0];

    return {
      ...toVenueCard(row),
      areaSqm: largest?.areaSqm ?? 0,
      capacity: largest?.capacity ?? 0,
      latitude: row.latitude,
      longitude: row.longitude,
      classes: await classCardsBy({ venue: { slug } }, limits.query.maxRows),
      events: await eventCardsBy({ venue: { slug } }, limits.query.maxRows),
      rating,
      reviews,
    };
  },
});

export const getVenueFacets = defineQuery({
  name: 'venueFacets',
  tags: () => [cacheTags.venues(), cacheTags.catalogStats()],
  revalidate: dataRevalidate.catalogStats,
  handler: async (): Promise<{
    districts: readonly FacetOption[];
    priceRange: { min: number; max: number };
  }> => {
    const rows = await db.venue.findMany({
      where: publicVenueWhere,
      select: {
        district: true,
        rooms: { where: { isActive: true }, select: { pricePerHour: true } },
      },
      take: limits.query.maxRows,
    });

    const prices = rows.flatMap((row) => row.rooms.map((room) => room.pricePerHour));

    return {
      districts: buildFacets(
        rows,
        (row) => [row.district],
        /** Район — данные, а не словарь: подпись берётся как есть. */
        (value) => value,
      ),
      priceRange: {
        min: prices.length > 0 ? Math.min(...prices) : 0,
        max: prices.length > 0 ? Math.max(...prices) : 0,
      },
    };
  },
});

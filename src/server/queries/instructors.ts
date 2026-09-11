/**
 * ИНСТРУКТОРЫ ИЗ БАЗЫ.
 *
 * ## Порядок в листинге считает домен, а не запрос
 *
 * `relevance` — счёт из `src/domain/ranking.ts`. Порядок в каталоге решает, кто
 * получит бронь, то есть это распределение дохода между исполнителями. Вторая
 * формула здесь означала бы вторую политику: одну в каталоге, другую в подборках
 * главной. Поэтому сортировка по релевантности считается в приложении, а не в
 * `ORDER BY`, — до появления `InstructorProfile.rankingScore`
 * (`docs/07-feature-backlog.md`), которое позволит отдать её базе.
 *
 * ## Каких сигналов ранжирования ещё нет
 *
 * Заполняемость, время ответа, доля отмен и неявок появятся вместе с историей
 * броней; в схеме под них нет колонок, и выдумывать значения нельзя — ранжирование
 * с придуманными сигналами хуже ранжирования без них, потому что выглядит
 * обоснованным. Пока они приходят нулями: ноль одинаков у всех и не искажает
 * относительный порядок.
 *
 * `createdAt` теперь настоящий, а не `null`, как было на фикстурах. Это меняет
 * поведение: поддержка новичка (`newcomerBonus`) начинает применяться. В
 * демо-данных все профили созданы сидом одновременно, поэтому бонус у всех
 * одинаковый и порядок от него не зависит.
 */

import 'server-only';

import { limits, reviews as reviewRules } from '@/config/business';
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
import type {
  CatalogPage,
  FacetOption,
  InstructorCardItem,
  InstructorDetail,
} from '@/domain/content';
import {
  danceStyleFromSlug,
  danceStyleLabelKey,
  danceStyleSlug,
  type DanceStyle,
} from '@/domain/enums';
import { relevanceKey, type RankingSignals } from '@/domain/ranking';
import { db } from '@/lib/db';
import { defineQuery } from '@/server/query';

import { classCardsBy } from './classes';
import { ratingFrom, reviewSelect, type ReviewRow } from './reviews';
import { firstMediaRef, type MediaRow } from './media';
import { mediaRelation, notTrashed } from './relations';
export const instructorSelect = {
  slug: true,
  headline: true,
  bio: true,
  styles: true,
  specializations: true,
  yearsExperience: true,
  hourlyRateFrom: true,
  isVerified: true,
  acceptsTravel: true,
  ratingAverage: true,
  ratingCount: true,
  studentCount: true,
  createdAt: true,
  user: { select: { name: true } },
  media: mediaRelation,
} as const;

/**
 * Только опубликованные и одобренные профили.
 *
 * `publishedAt: null` — профиль, который исполнитель ещё не открыл; `moderation`
 * — тот, что не прошёл проверку. Ни один из них не должен встречаться в каталоге,
 * и условие вынесено в константу, чтобы это нельзя было забыть в одном запросе.
 */
export const publicInstructorWhere = {
  moderation: 'APPROVED' as const,
  publishedAt: { not: null },
  user: { isActive: true },
};

export interface InstructorRow {
  slug: string;
  headline: string;
  bio: string;
  styles: DanceStyle[];
  specializations: string[];
  yearsExperience: number;
  hourlyRateFrom: number;
  isVerified: boolean;
  acceptsTravel: boolean;
  ratingAverage: unknown;
  ratingCount: number;
  studentCount: number;
  createdAt: Date;
  user: { name: string };
  media: MediaRow[];
}

function ratingNumber(value: unknown): number {
  return value === null || value === undefined ? 0 : Number(value);
}

export function toInstructorCard(row: InstructorRow): InstructorCardItem {
  return {
    slug: row.slug,
    name: row.user.name,
    headline: row.headline,
    styles: row.styles,
    yearsExperience: row.yearsExperience,
    hourlyRateFrom: row.hourlyRateFrom,
    ratingAverage: ratingNumber(row.ratingAverage),
    ratingCount: row.ratingCount,
    isVerified: row.isVerified,
    image: firstMediaRef(row.media) ?? { key: '', alt: { hy: '', ru: '', en: '' } },
  };
}

/**
 * Поля, от которых зависит порядок в листинге.
 *
 * Отдельный тип, а не весь `InstructorRow`: тест порядка не должен собирать
 * фотографии, биографию и специализации, чтобы проверить сортировку.
 */
export interface InstructorRankingRow {
  ratingAverage: unknown;
  ratingCount: number;
  studentCount: number;
  createdAt: Date;
  isVerified: boolean;
  hourlyRateFrom: number;
}

/**
 * Сигналы ранжирования из строки профиля.
 *
 * Экспортируется ради теста: порядок в листинге — это распределение броней между
 * людьми, и проверять его нужно на явных данных, а не на том, что случайно лежит
 * в базе разработчика.
 */
export function rankingSignals(row: InstructorRankingRow): RankingSignals {
  return {
    averageRating: ratingNumber(row.ratingAverage),
    reviewCount: row.ratingCount,
    fillRate: 0,
    responseTimeMinutes: 0,
    cancellationRate: 0,
    noShowRate: 0,
    /** Подменяет число проведённых занятий: в схеме это `Booking` со `COMPLETED`. */
    completedBookings: row.studentCount,
    createdAt: row.createdAt,
    isVerified: row.isVerified,
    /** Платного размещения ещё нет: `BoostCampaign` — задача B-07. */
    boostedUntil: null,
  };
}

function instructorWhere(query: CatalogQuery) {
  const style = query.style ? danceStyleFromSlug(query.style) ?? undefined : undefined;

  return {
    ...publicInstructorWhere,
    ...(style ? { styles: { has: style } } : {}),
    /*
     * Район у инструктора — свойство его занятий: своего адреса у него нет, он
     * приезжает в зал. Условие через связь, а не через денормализованное поле:
     * поле пришлось бы поддерживать при каждом изменении расписания.
     */
    ...(query.district ? { classes: { some: { venue: { district: query.district } } } } : {}),
    ...(query.priceMin !== undefined || query.priceMax !== undefined
      ? {
          hourlyRateFrom: {
            ...(query.priceMin !== undefined ? { gte: query.priceMin } : {}),
            ...(query.priceMax !== undefined ? { lte: query.priceMax } : {}),
          },
        }
      : {}),
  };
}

function matchesText(row: InstructorRow, term: string | undefined): boolean {
  return matchesQuery(term, [
    row.user.name,
    row.headline,
    row.bio,
    ...row.specializations,
    ...row.styles,
  ]);
}

export function instructorSortKeys(now: Date) {
  return {
    relevance: (row: InstructorRankingRow) => relevanceKey(rankingSignals(row), now),
    price: (row: InstructorRankingRow) => row.hourlyRateFrom,
    rating: (row: InstructorRankingRow) => ratingNumber(row.ratingAverage),
    createdAt: (row: InstructorRankingRow) => row.createdAt.getTime(),
  };
}

/**
 * Доступные варианты сортировки для листинга.
 *
 * Выводятся из набора ключей, а не перечисляются: сортировка, которой нет в
 * запросе, не должна появляться в выпадающем списке.
 */
export const instructorSortOptions: readonly CatalogSort[] = availableSorts(
  instructorSortKeys(new Date()),
);

export const getInstructorList = defineQuery({
  name: 'instructorList',
  tags: () => [cacheTags.instructors()],
  revalidate: dataRevalidate.catalog,
  handler: async (query: CatalogQuery): Promise<CatalogPage<InstructorCardItem>> => {
    const rows = (await db.instructorProfile.findMany({
      where: instructorWhere(query),
      select: instructorSelect,
      take: limits.query.maxRows,
    })) as unknown as InstructorRow[];

    const filtered = rows.filter((row) => matchesText(row, query.q));
    const sorted = sortByOption(filtered, query.sort, instructorSortKeys(new Date()));
    const page = paginate(sorted, query.page, query.pageSize);

    return { ...page, items: page.items.map(toInstructorCard) };
  },
});

export const getInstructorDetail = defineQuery({
  name: 'instructorDetail',
  tags: (slug: string) => [cacheTags.instructor(slug), cacheTags.instructors()],
  revalidate: dataRevalidate.entity,
  handler: async (slug: string): Promise<InstructorDetail | null> => {
    const row = (await db.instructorProfile.findFirst({
      where: { slug, ...publicInstructorWhere },
      select: {
        ...instructorSelect,
        experiences: {
          orderBy: { sortOrder: 'asc' },
          select: {
            title: true,
            organization: true,
            location: true,
            startYear: true,
            endYear: true,
          },
        },
        reviews: {
          where: { moderation: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          take: limits.pagination.reviewsPerPage,
          select: reviewSelect,
        },
        /* Площадки — через занятия: у инструктора нет своего зала. */
        classes: {
          where: { ...notTrashed, isActive: true, venue: { isNot: null } },
          select: { venue: { select: { slug: true, name: true } } },
        },
      },
    })) as unknown as
      | (InstructorRow & {
          experiences: Array<{
            title: string;
            organization: string | null;
            location: string | null;
            startYear: number;
            endYear: number | null;
          }>;
          reviews: ReviewRow[];
          classes: Array<{ venue: { slug: string; name: string } | null }>;
        })
      | null;

    if (!row) return null;

    /*
     * Среднее берётся из профиля, а не из выборки отзывов: денормализованный
     * счётчик пересчитывается при модерации и знает про все отзывы, а выборка —
     * только про первую страницу.
     */
    const { rating, items: reviews } = ratingFrom(row.reviews, {
      average: ratingNumber(row.ratingAverage),
      count: row.ratingCount,
    });

    const venues = [
      ...new Map(
        row.classes
          .map((entry) => entry.venue)
          .filter((venue): venue is { slug: string; name: string } => venue !== null)
          .map((venue) => [venue.slug, venue]),
      ).values(),
    ];

    return {
      ...toInstructorCard(row),
      bio: row.bio,
      specializations: row.specializations,
      studentCount: row.studentCount,
      acceptsTravel: row.acceptsTravel,
      experience: row.experiences.map((entry) => ({
        title: entry.title,
        ...(entry.organization ? { organization: entry.organization } : {}),
        ...(entry.location ? { location: entry.location } : {}),
        startYear: entry.startYear,
        ...(entry.endYear ? { endYear: entry.endYear } : {}),
      })),
      classes: await classCardsBy({ instructor: { slug } }, limits.query.maxRows),
      venues,
      rating,
      reviews,
    };
  },
});

export const getInstructorFacets = defineQuery({
  name: 'instructorFacets',
  tags: () => [cacheTags.instructors(), cacheTags.catalogStats()],
  revalidate: dataRevalidate.catalogStats,
  handler: async (): Promise<{
    styles: readonly FacetOption[];
    districts: readonly FacetOption[];
    priceRange: { min: number; max: number };
  }> => {
    const rows = await db.instructorProfile.findMany({
      where: publicInstructorWhere,
      select: {
        styles: true,
        hourlyRateFrom: true,
        classes: { where: notTrashed, select: { venue: { select: { district: true } } } },
      },
      take: limits.query.maxRows,
    });

    const prices = rows.map((row) => row.hourlyRateFrom);

    return {
      styles: buildFacets(
        rows,
        (row) => row.styles.map(danceStyleSlug),
        (value) => danceStyleLabelKey(danceStyleFromSlug(value) as DanceStyle),
      ),
      districts: buildFacets(
        rows,
        /* Район считается один раз на инструктора, а не на каждое его занятие. */
        (row) => [
          ...new Set(
            row.classes
              .map((entry) => entry.venue?.district)
              .filter((district): district is string => Boolean(district)),
          ),
        ],
        (value) => value,
      ),
      priceRange: {
        min: prices.length > 0 ? Math.min(...prices) : 0,
        max: prices.length > 0 ? Math.max(...prices) : 0,
      },
    };
  },
});

/** Показывать ли среднюю оценку. Одна оценка по одному отзыву — не оценка. */
export function showsAverageRating(rating: { count: number }): boolean {
  return rating.count >= reviewRules.minCountToDisplayAverage;
}

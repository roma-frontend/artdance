/**
 * ПОИСК ПО ПУБЛИЧНОМУ КАТАЛОГУ ИЗ БАЗЫ.
 *
 * Текстовый отбор остаётся в приложении: `rankSearchCandidates` использует тот
 * же транслитерационный ключ, который сводит հայերեն / русский / English и
 * прощает короткую опечатку. PostgreSQL `ILIKE` этого не умеет; перенос в SQL
 * допустим только вместе с эквивалентным индексом нормализованных ключей.
 *
 * Строка запроса намеренно не становится ключом `defineQuery`: пространство
 * префиксов почти не ограничено, и кешировать каждый ввод значит растить кеш
 * без повторных попаданий. Вместо этого конечный публичный корпус каждого
 * раздела кешируется по одной из трёх локалей и сущностным тегам, а ранжирование
 * строки всегда считается заново. Каждая выборка ограничена
 * `limits.query.maxRows`.
 */

import 'server-only';

import { limits } from '@/config/business';
import { cacheTags, dataRevalidate } from '@/config/cache';
import { routes } from '@/config/routes';
import {
  rankSearchCandidates,
  type SearchCandidate,
} from '@/domain/search-ranking';
import {
  isSearchScopeEnabled,
  type SearchHit,
  type SearchHitScope,
  type SearchScope,
} from '@/domain/search';
import type { Locale } from '@/i18n/config';
import { db } from '@/lib/db';
import { defineQuery } from '@/server/query';

import { classSelect, publicClassWhere } from './classes';
import { instructorSelect, publicInstructorWhere } from './instructors';
import { firstMediaRef } from './media';
import {
  activeVariantsRelation,
  mediaRelation,
  notTrashed,
} from './relations';
import { productSelect, publicProductWhere } from './products';
import { publicVenueWhere, venueSelect } from './venues';

const stableCatalogOrder = [{ createdAt: 'asc' as const }, { slug: 'asc' as const }];

function imageKey(media: Parameters<typeof firstMediaRef>[0]): string {
  return firstMediaRef(media)?.key ?? '';
}

async function classCandidates(locale: Locale): Promise<SearchCandidate[]> {
  const rows = await db.danceClass.findMany({
    where: publicClassWhere,
    orderBy: stableCatalogOrder,
    select: {
      ...classSelect,
      translations: {
        where: { locale },
        select: { title: true, description: true, learningPoints: true },
      },
    },
    take: limits.query.maxRows,
  });

  return rows.map((row) => {
    const translation = row.translations[0];
    const title = translation?.title ?? row.title;
    const description = translation?.description ?? row.description;
    const learningPoints = translation?.learningPoints ?? row.learningPoints;

    return {
      id: `class-${row.slug}`,
      scope: 'classes',
      title,
      subtitle: row.instructor.user.name,
      href: routes.class(row.slug),
      image: imageKey(row.media),
      price: row.price,
      fields: [
        description,
        row.title,
        row.description,
        row.instructor.user.name,
        row.venue?.name,
        row.venue?.district,
        ...learningPoints,
        ...row.learningPoints,
      ],
      styles: [row.style],
    };
  });
}

async function instructorCandidates(locale: Locale): Promise<SearchCandidate[]> {
  const rows = await db.instructorProfile.findMany({
    where: publicInstructorWhere,
    orderBy: stableCatalogOrder,
    select: {
      ...instructorSelect,
      translations: {
        where: { locale },
        select: { headline: true, bio: true },
      },
    },
    take: limits.query.maxRows,
  });

  return rows.map((row) => {
    const translation = row.translations[0];
    const headline = translation?.headline ?? row.headline;
    const bio = translation?.bio ?? row.bio;

    return {
      id: `instructor-${row.slug}`,
      scope: 'instructors',
      title: row.user.name,
      subtitle: headline,
      href: routes.instructor(row.slug),
      image: imageKey(row.media),
      price: row.hourlyRateFrom,
      fields: [
        headline,
        bio,
        row.headline,
        row.bio,
        ...row.specializations,
      ],
      styles: row.styles,
    };
  });
}

async function venueCandidates(locale: Locale): Promise<SearchCandidate[]> {
  const rows = await db.venue.findMany({
    where: publicVenueWhere,
    orderBy: stableCatalogOrder,
    select: {
      ...venueSelect,
      translations: {
        where: { locale },
        select: { name: true, description: true },
      },
      classes: {
        where: { ...notTrashed, ...publicClassWhere },
        select: { style: true },
      },
    },
    take: limits.query.maxRows,
  });

  return rows.map((row) => {
    const translation = row.translations[0];
    const name = translation?.name ?? row.name;
    const description = translation?.description ?? row.description;
    const roomAmenities = row.rooms.flatMap((room) => room.amenities);
    const prices = row.rooms.map((room) => room.pricePerHour);

    return {
      id: `venue-${row.slug}`,
      scope: 'studios',
      title: name,
      subtitle: row.district,
      href: routes.studio(row.slug),
      image: imageKey(row.media),
      price: prices.length > 0 ? Math.min(...prices) : 0,
      fields: [
        description,
        row.name,
        row.description,
        row.district,
        ...row.amenities,
        ...roomAmenities,
      ],
      styles: [...new Set(row.classes.map((entry) => entry.style))],
    };
  });
}

async function eventCandidates(locale: Locale): Promise<SearchCandidate[]> {
  const rows = await db.event.findMany({
    where: { isPublished: true, endsAt: { gte: new Date() } },
    orderBy: stableCatalogOrder,
    select: {
      slug: true,
      title: true,
      description: true,
      locationName: true,
      price: true,
      media: mediaRelation,
      translations: {
        where: { locale },
        select: { title: true, description: true },
      },
      venue: {
        select: {
          name: true,
          translations: {
            where: { locale },
            select: { name: true },
          },
        },
      },
    },
    take: limits.query.maxRows,
  });

  return rows.map((row) => {
    const translation = row.translations[0];
    const venueName = row.venue?.translations[0]?.name ?? row.venue?.name;

    return {
      id: `event-${row.slug}`,
      scope: 'events',
      title: translation?.title ?? row.title,
      subtitle: venueName ?? row.locationName ?? '',
      href: routes.event(row.slug),
      image: imageKey(row.media),
      price: row.price,
      fields: [
        translation?.description,
        row.title,
        row.description,
        row.locationName ?? undefined,
        venueName,
        row.venue?.name,
      ],
    };
  });
}

async function productCandidates(locale: Locale): Promise<SearchCandidate[]> {
  const rows = await db.product.findMany({
    where: publicProductWhere,
    orderBy: stableCatalogOrder,
    select: {
      ...productSelect,
      translations: {
        where: { locale },
        select: { title: true, description: true },
      },
      variants: activeVariantsRelation,
    },
    take: limits.query.maxRows,
  });

  return rows.map((row) => {
    const translation = row.translations[0];
    const prices = row.variants.map((variant) => variant.price);

    return {
      id: `product-${row.slug}`,
      scope: 'products',
      title: translation?.title ?? row.title,
      subtitle: row.brand ?? '',
      href: routes.product(row.slug),
      image: imageKey(row.media),
      price: prices.length > 0 ? Math.min(...prices) : row.basePrice,
      fields: [
        translation?.description,
        row.title,
        row.description,
        row.brand ?? undefined,
        ...row.variants.flatMap((variant) => [
          variant.size ?? undefined,
          variant.color ?? undefined,
        ]),
      ],
    };
  });
}

const getClassCandidates = defineQuery({
  name: 'searchClasses',
  tags: () => [cacheTags.classes(), cacheTags.instructors(), cacheTags.venues()],
  revalidate: dataRevalidate.catalog,
  handler: classCandidates,
});

const getInstructorCandidates = defineQuery({
  name: 'searchInstructors',
  tags: () => [cacheTags.instructors()],
  revalidate: dataRevalidate.catalog,
  handler: instructorCandidates,
});

const getVenueCandidates = defineQuery({
  name: 'searchVenues',
  tags: () => [cacheTags.venues(), cacheTags.classes()],
  revalidate: dataRevalidate.catalog,
  handler: venueCandidates,
});

const getEventCandidates = defineQuery({
  name: 'searchEvents',
  tags: () => [cacheTags.events(), cacheTags.venues()],
  revalidate: dataRevalidate.catalog,
  handler: eventCandidates,
});

const getProductCandidates = defineQuery({
  name: 'searchProducts',
  tags: () => [cacheTags.products()],
  revalidate: dataRevalidate.catalog,
  handler: productCandidates,
});

/** Ищет только по включённым публичным разделам и отдаёт локализованные поля. */
export async function searchCatalog(
  term: string,
  scope: SearchScope,
  limit: number,
  locale: Locale,
): Promise<readonly SearchHit[]> {
  const wants = (candidate: SearchHitScope): boolean =>
    (scope === 'all' || scope === candidate) && isSearchScopeEnabled(candidate);

  const [classes, instructors, venues, events, products] = await Promise.all([
    wants('classes') ? getClassCandidates(locale) : Promise.resolve([]),
    wants('instructors') ? getInstructorCandidates(locale) : Promise.resolve([]),
    wants('studios') ? getVenueCandidates(locale) : Promise.resolve([]),
    wants('events') ? getEventCandidates(locale) : Promise.resolve([]),
    wants('products') ? getProductCandidates(locale) : Promise.resolve([]),
  ]);

  return rankSearchCandidates(
    [...classes, ...instructors, ...venues, ...events, ...products],
    term,
    limit,
  );
}

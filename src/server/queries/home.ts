/**
 * ГЛАВНАЯ ИЗ PRISMA + CONTENTBLOCK.
 *
 * ContentBlock задаёт порядок и медиа; сущности перечитываются по публичным
 * условиям каталога. Скрытая или удалённая запись просто выпадает из подборки —
 * CMS не может вернуть её в публичный интерфейс одним слагом.
 */

import 'server-only';

import { homeContentConfig, parseHomeContentBlock } from '@/config/home-content';
import { cacheTags, dataRevalidate } from '@/config/cache';
import type {
  HomeContent,
  MediaRef,
  TestimonialItem,
} from '@/domain/content';
import { danceStyleSlug } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { db } from '@/lib/db';
import { defineQuery } from '@/server/query';

import {
  classSelect,
  publicClassWhere,
  toClassCard,
  type ClassRow,
} from './classes';
import {
  eventSelect,
  publicEventWhere,
  toEventCard,
} from './events';
import {
  instructorSelect,
  publicInstructorWhere,
  toInstructorCard,
  type InstructorRow,
} from './instructors';
import { mediaSelect, toMediaRef, type MediaRow } from './media';
import {
  productSelect,
  publicProductWhere,
  toProductCard,
  type ProductRow,
} from './products';
import { approvedReviewsWhere, reviewSelect, toReview, type ReviewRow } from './reviews';
import { upcomingSessionsRelation } from './relations';
import { getStyleSummaries } from './styles';
import {
  publicVenueWhere,
  toVenueCard,
  venueSelect,
  type VenueRow,
} from './venues';

function orderedBy<T>(
  order: readonly string[],
  rows: readonly T[],
  key: (row: T) => string,
): readonly T[] {
  const byKey = new Map(rows.map((row) => [key(row), row]));
  return order.map((item) => byKey.get(item)).filter((row): row is T => row !== undefined);
}

function translationOf<T>(translations: readonly T[]): T | undefined {
  return translations[0];
}

function testimonialFrom(row: ReviewRow): TestimonialItem {
  const review = toReview(row);
  return {
    id: review.id,
    authorName: review.authorName,
    authorRole: review.authorRole,
    rating: review.rating,
    body: review.body,
    image: review.image,
  };
}

async function loadHomeContent(locale: Locale): Promise<HomeContent> {
  const block = await db.contentBlock.findUnique({
    where: { key_locale: { key: homeContentConfig.blockKey, locale } },
    select: { body: true, isActive: true },
  });

  if (!block?.isActive) {
    throw new Error(`home content block is missing or inactive for locale ${locale}`);
  }

  const config = parseHomeContentBlock(block.body);
  const mediaKeys = [
    config.media.heroPosterStorageKey,
    config.media.editorialPosterStorageKey,
    config.media.competitionPosterStorageKey,
    ...config.styleTiles.map((tile) => tile.mediaStorageKey),
  ];

  const now = new Date();
  const [
    mediaRows,
    styleSummaries,
    classRows,
    instructorRows,
    venueRows,
    productRows,
    eventRows,
    testimonialRows,
  ] = await Promise.all([
    db.mediaAsset.findMany({
      where: { storageKey: { in: mediaKeys } },
      select: mediaSelect,
    }),
    getStyleSummaries(),
    db.danceClass.findMany({
      where: {
        ...publicClassWhere,
        slug: { in: config.collections.popularClassSlugs },
      },
      select: {
        ...classSelect,
        sessions: upcomingSessionsRelation(now, 1),
        translations: {
          where: { locale },
          select: { title: true, description: true, learningPoints: true },
        },
      },
    }),
    db.instructorProfile.findMany({
      where: {
        ...publicInstructorWhere,
        slug: { in: config.collections.instructorSlugs },
      },
      select: {
        ...instructorSelect,
        translations: {
          where: { locale },
          select: { headline: true, bio: true },
        },
      },
    }),
    db.venue.findMany({
      where: {
        ...publicVenueWhere,
        slug: { in: config.collections.venueSlugs },
      },
      select: {
        ...venueSelect,
        translations: {
          where: { locale },
          select: { name: true, description: true },
        },
      },
    }),
    db.product.findMany({
      where: {
        ...publicProductWhere,
        slug: { in: config.collections.productSlugs },
      },
      select: {
        ...productSelect,
        translations: {
          where: { locale },
          select: { title: true, description: true },
        },
      },
    }),
    db.event.findMany({
      where: {
        ...publicEventWhere(now),
        slug: { in: config.collections.eventSlugs },
      },
      select: {
        ...eventSelect,
        translations: {
          where: { locale },
          select: { title: true, description: true },
        },
        venue: {
          select: {
            ...eventSelect.venue.select,
            translations: {
              where: { locale },
              select: { name: true },
            },
          },
        },
      },
    }),
    db.review.findMany({
      where: {
        ...approvedReviewsWhere,
        author: { email: { in: config.collections.testimonialAuthorEmails } },
      },
      select: {
        ...reviewSelect,
        author: { select: { name: true, email: true } },
      },
    }),
  ]);

  const mediaByKey = new Map(
    (mediaRows as MediaRow[]).map((row) => [row.storageKey, toMediaRef(row)]),
  );
  const requireMedia = (storageKey: string): MediaRef => {
    const media = mediaByKey.get(storageKey);
    if (!media) throw new Error(`home content references missing media ${storageKey}`);
    return media;
  };

  const summariesByStyle = new Map(styleSummaries.map((summary) => [summary.style, summary]));

  const classes = classRows.map((row) => {
    const translation = translationOf(row.translations);
    return toClassCard({
      ...row,
      title: translation?.title ?? row.title,
      description: translation?.description ?? row.description,
      learningPoints: translation?.learningPoints ?? row.learningPoints,
    } as unknown as ClassRow);
  });

  const instructors = instructorRows.map((row) => {
    const translation = translationOf(row.translations);
    return toInstructorCard({
      ...row,
      headline: translation?.headline ?? row.headline,
      bio: translation?.bio ?? row.bio,
    } as unknown as InstructorRow);
  });

  const venues = venueRows.map((row) => {
    const translation = translationOf(row.translations);
    return toVenueCard({
      ...row,
      name: translation?.name ?? row.name,
      description: translation?.description ?? row.description,
    } as unknown as VenueRow);
  });

  const products = productRows.map((row) => {
    const translation = translationOf(row.translations);
    return toProductCard({
      ...row,
      title: translation?.title ?? row.title,
      description: translation?.description ?? row.description,
    } as unknown as ProductRow);
  });

  const events = eventRows.map((row) => {
    const translation = translationOf(row.translations);
    const venueTranslation = translationOf(row.venue?.translations ?? []);
    return toEventCard({
      ...row,
      title: translation?.title ?? row.title,
      description: translation?.description ?? row.description,
      venue: row.venue
        ? { ...row.venue, name: venueTranslation?.name ?? row.venue.name }
        : null,
    } as never);
  });

  const testimonials = testimonialRows.map((row) => ({
    row,
    email: row.author.email,
  }));

  return {
    hero: {
      video: null,
      image: requireMedia(config.media.heroPosterStorageKey),
      stats: config.stats,
    },
    editorial: {
      video: null,
      image: requireMedia(config.media.editorialPosterStorageKey),
    },
    competition: {
      video: null,
      image: requireMedia(config.media.competitionPosterStorageKey),
    },
    styleTiles: config.styleTiles.map((tile) => ({
      style: tile.style,
      slug: danceStyleSlug(tile.style),
      image: requireMedia(tile.mediaStorageKey),
      classCount: summariesByStyle.get(tile.style)?.classCount ?? 0,
    })),
    popularClasses: orderedBy(config.collections.popularClassSlugs, classes, (row) => row.slug),
    instructors: orderedBy(config.collections.instructorSlugs, instructors, (row) => row.slug),
    venues: orderedBy(config.collections.venueSlugs, venues, (row) => row.slug),
    products: orderedBy(config.collections.productSlugs, products, (row) => row.slug),
    events: orderedBy(config.collections.eventSlugs, events, (row) => row.slug),
    testimonials: orderedBy(
      config.collections.testimonialAuthorEmails,
      testimonials,
      (entry) => entry.email,
    ).map((entry) => testimonialFrom(entry.row as unknown as ReviewRow)),
  };
}

export const getHomePageContent = defineQuery({
  name: 'homePageContent',
  tags: () => [
    cacheTags.content(homeContentConfig.blockKey),
    cacheTags.classes(),
    cacheTags.instructors(),
    cacheTags.venues(),
    cacheTags.products(),
    cacheTags.events(),
    cacheTags.catalogStats(),
  ],
  revalidate: dataRevalidate.catalog,
  handler: loadHomeContent,
});

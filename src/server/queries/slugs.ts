/**
 * СЛАГИ КАТАЛОГА ДЛЯ СБОРКИ И КАРТЫ САЙТА.
 *
 * Один запрос на два потребителя: `generateStaticParams` и `sitemap.ts`.
 * Страница, собранная статически, но не попавшая в карту сайта, — это
 * оплаченная сборка, которую никто не найдёт; страница в карте сайта, которой не
 * собрали, — 404 в выдаче. Раздельные источники расходятся именно так.
 *
 * Условия публичности те же, что в листингах: снятое с публикации не должно ни
 * собираться, ни попадать в карту сайта.
 */

import 'server-only';

import { limits } from '@/config/business';
import { cacheTags, dataRevalidate } from '@/config/cache';
import { db } from '@/lib/db';
import { defineQuery } from '@/server/query';

export interface CatalogSlugs {
  classes: readonly string[];
  instructors: readonly string[];
  venues: readonly string[];
  events: readonly string[];
  products: readonly string[];
}

export const getCatalogSlugs = defineQuery({
  name: 'catalogSlugs',
  tags: () => [
    cacheTags.classes(),
    cacheTags.instructors(),
    cacheTags.venues(),
    cacheTags.events(),
    cacheTags.products(),
  ],
  revalidate: dataRevalidate.catalogStats,
  handler: async (): Promise<CatalogSlugs> => {
    const approved = { moderation: 'APPROVED' as const, publishedAt: { not: null } };
    const select = { slug: true };
    const take = limits.query.maxRows;

    const [classes, instructors, venues, events, products] = await Promise.all([
      db.danceClass.findMany({ where: { isActive: true, instructor: approved }, select, take }),
      db.instructorProfile.findMany({ where: { ...approved, user: { isActive: true } }, select, take }),
      db.venue.findMany({ where: approved, select, take }),
      /*
       * События собираются все опубликованные, включая прошедшие: их страницы
       * уже в индексе и в чьих-то календарях, и 404 вместо них теряет контекст.
       * Из афиши прошедшее при этом уходит (см. `queries/events.ts`).
       */
      db.event.findMany({ where: { isPublished: true }, select, take }),
      db.product.findMany({ where: { isActive: true }, select, take }),
    ]);

    return {
      classes: classes.map((row) => row.slug),
      instructors: instructors.map((row) => row.slug),
      venues: venues.map((row) => row.slug),
      events: events.map((row) => row.slug),
      products: products.map((row) => row.slug),
    };
  },
});

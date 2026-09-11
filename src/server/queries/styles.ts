/**
 * НАПРАВЛЕНИЯ ИЗ БАЗЫ.
 *
 * Направление — это enum домена, а не строка таблицы: список танцев не заводит
 * заказчик, он фиксирован (`danceStyles`). Из базы приходит то, что вокруг
 * направления есть: занятия, преподаватели, залы, цены, уровни, районы.
 *
 * ## Счётчики считаются, а не берутся из контента
 *
 * У плитки на главной числа макетные (48 занятий по хип-хопу) — это утверждённый
 * контент прототипа. Хаб же ПОКАЗЫВАЕТ занятия рядом со счётчиком, и «48» над
 * одной карточкой не украшение, а ошибка. Поэтому здесь `count`, а не контент.
 *
 * ## Кадр направления — обложка занятия
 *
 * Своего изображения у направления нет и негде быть: `MediaAsset` привязывается к
 * сущностям, а не к enum'у (кураторская подборка кадров появится с `ContentBlock`,
 * A-17). Берётся обложка занятия этого направления: если хип-хоп ведут, кадр с
 * занятия показывает именно его. `null` — легальное состояние; фотография другого
 * танца хуже отсутствия фотографии, потому что утверждает неправду.
 */

import 'server-only';

import { limits } from '@/config/business';
import { cacheTags, dataRevalidate } from '@/config/cache';
import type { StyleHubDetail, StyleSummary } from '@/domain/content';
import {
  danceStyleFromSlug,
  danceStyleSlug,
  danceStyles,
  relatedDanceStyles,
  skillLevels,
  type DanceStyle,
} from '@/domain/enums';
import { db } from '@/lib/db';
import { defineQuery } from '@/server/query';

import { classCardsBy } from './classes';
import { firstMediaRef, mediaSelect, type MediaRow } from './media';
import { toInstructorCard } from './instructors';
import { toVenueCard } from './venues';
import { activeRoomsRelation, mediaRelation, notTrashed } from './relations';

/**
 * Сводка по каждому направлению одним проходом.
 *
 * Восемнадцать направлений — это восемнадцать пар запросов, если считать по
 * одному. Здесь два запроса на всё: занятия с обложками и направления
 * преподавателей. Разница заметна на `/styles`, где нужны все сводки сразу.
 */
async function loadSummaries(): Promise<Map<DanceStyle, StyleSummary>> {
  const [classRows, instructorRows] = await Promise.all([
    db.danceClass.findMany({
      where: { isActive: true, instructor: { moderation: 'APPROVED', publishedAt: { not: null } } },
      select: { style: true, media: { select: mediaSelect } },
      take: limits.query.maxRows,
    }),
    db.instructorProfile.findMany({
      where: { moderation: 'APPROVED', publishedAt: { not: null }, user: { isActive: true } },
      select: { styles: true },
      take: limits.query.maxRows,
    }),
  ]);

  const summaries = new Map<DanceStyle, StyleSummary>();

  for (const style of danceStyles) {
    const classes = classRows.filter((row) => row.style === style);
    const withMedia = classes.find((row) => row.media.length > 0);

    summaries.set(style, {
      style,
      slug: danceStyleSlug(style),
      image: withMedia ? firstMediaRef(withMedia.media as MediaRow[]) : null,
      classCount: classes.length,
      instructorCount: instructorRows.filter((row) => row.styles.includes(style)).length,
    });
  }

  return summaries;
}

/** Все направления в порядке `danceStyles` — для перечня на `/styles`. */
export const getStyleSummaries = defineQuery({
  name: 'styleSummaries',
  tags: () => [cacheTags.classes(), cacheTags.instructors(), cacheTags.catalogStats()],
  revalidate: dataRevalidate.catalogStats,
  handler: async (): Promise<readonly StyleSummary[]> => {
    const summaries = await loadSummaries();
    return danceStyles.map((style) => summaries.get(style)!);
  },
});

/**
 * Сводка по направлению или `null`, если слаг неизвестен.
 *
 * `null` вместо исключения: слаг приходит из URL, то есть от кого угодно, и
 * `/styles/tap-dance` — это 404, а не сломанные данные.
 */
export const getStyleHub = defineQuery({
  name: 'styleHub',
  tags: () => [cacheTags.classes(), cacheTags.instructors(), cacheTags.venues()],
  revalidate: dataRevalidate.entity,
  handler: async (slug: string): Promise<StyleHubDetail | null> => {
    const style = danceStyleFromSlug(slug);
    if (!style) return null;

    const summaries = await loadSummaries();
    const summary = summaries.get(style);
    if (!summary) return null;

    const publicClass = {
      isActive: true,
      instructor: { ...notTrashed, moderation: 'APPROVED' as const, publishedAt: { not: null } },
      style,
    };

    const [classes, instructorRows, venueRows, aggregate, facts] = await Promise.all([
      classCardsBy({ style }, limits.styleHub.classes),
      db.instructorProfile.findMany({
        where: {
          moderation: 'APPROVED',
          publishedAt: { not: null },
          user: { isActive: true },
          styles: { has: style },
        },
        orderBy: { ratingAverage: 'desc' },
        take: limits.styleHub.instructors,
        select: {
          slug: true,
          headline: true,
          styles: true,
          yearsExperience: true,
          hourlyRateFrom: true,
          isVerified: true,
          ratingAverage: true,
          ratingCount: true,
          user: { select: { name: true } },
          media: mediaRelation,
        },
      }),
      /* Залы, где этому учат: связь только через занятия. */
      db.venue.findMany({
        where: {
          moderation: 'APPROVED',
          publishedAt: { not: null },
          classes: { some: { ...publicClass, ...notTrashed } },
        },
        take: limits.styleHub.venues,
        select: {
          slug: true,
          name: true,
          description: true,
          district: true,
          amenities: true,
          ratingAverage: true,
          ratingCount: true,
          media: mediaRelation,
          rooms: activeRoomsRelation,
        },
      }),
      /* Минимальная цена занятия: «от» в шапке хаба. */
      db.danceClass.aggregate({ where: publicClass, _min: { price: true } }),
      /*
       * Уровни и районы: нужны все значения, а не первая страница, поэтому
       * отдельная выборка двух колонок вместо разбора карточек.
       */
      db.danceClass.findMany({
        where: publicClass,
        select: { level: true, venue: { select: { district: true } } },
        take: limits.query.maxRows,
      }),
    ]);

    return {
      ...summary,
      classes,
      instructors: instructorRows.map((row) => toInstructorCard(row as never)),
      venues: venueRows.map((row) => toVenueCard(row as never)),
      priceFrom: aggregate._min.price ?? null,
      /* Порядок уровней — как в словаре, а не как в данных: «начальный» перед «средним». */
      levels: skillLevels.filter((level) => facts.some((row) => row.level === level)),
      districts: [
        ...new Set(
          facts
            .map((row) => row.venue?.district)
            .filter((district): district is string => Boolean(district)),
        ),
      ],
      related: relatedDanceStyles(style)
        .map((related) => summaries.get(related))
        .filter((entry): entry is StyleSummary => entry !== undefined),
    };
  },
});

/**
 * Направления, у которых есть что показать: занятие или преподаватель.
 *
 * Только они попадают в карту сайта и в индекс. Хаб без предложения остаётся
 * доступным по адресу — у него есть описание направления и соседние направления,
 * — но приглашать поисковик на «уроки фламенко в Ереване», которых нет, значит
 * обещать несуществующее и получить отказ на первом же переходе.
 */
export const getStyleHubSlugs = defineQuery({
  name: 'styleHubSlugs',
  tags: () => [cacheTags.classes(), cacheTags.instructors()],
  revalidate: dataRevalidate.catalogStats,
  handler: async (): Promise<readonly string[]> => {
    const summaries = await loadSummaries();

    return danceStyles
      .filter((style) => {
        const summary = summaries.get(style);
        return summary !== undefined && (summary.classCount > 0 || summary.instructorCount > 0);
      })
      .map(danceStyleSlug);
  },
});

/**
 * КУРСЫ ИЗ БАЗЫ.
 *
 * Раздел `/courses` был заглушкой «скоро», а таблицы `Course`, `CourseLesson`,
 * `CourseEnrollment` и `LessonProgress` существовали с самого начала. Этот
 * модуль — то, что превращает схему в раздел: список, страница курса, урок и
 * слаги для сборки и карты сайта.
 *
 * ## Что здесь важно
 *
 * **Переводы собираются с откатом.** `CourseTranslation` необязательна:
 * локаль без перевода получает базовые поля. Пустой заголовок вместо русского
 * названия — худший вариант: он выглядит как сломанная страница.
 *
 * **Видео урока — по явному join'у.** У `CourseLesson.videoAssetId` нет внешнего
 * ключа в схеме (видео может быть удалено из медиатеки, а урок — остаться).
 * Поэтому кадр ищется отдельным запросом по `storageKey`, и отсутствие файла —
 * легальное состояние: урок без видео всё равно в программе.
 *
 * **Публичность — `isPublished`.** Черновик курса не попадает ни в список, ни в
 * слаги, ни в карту сайта: три места, где одна ошибка публикации стоит дороже
 * всего.
 */

import 'server-only';

import { limits } from '@/config/business';
import { cacheTags, dataRevalidate } from '@/config/cache';
import type { CatalogPage, MediaRef } from '@/domain/content';
import { emptyCatalogPage } from '@/domain/content';
import type { DanceStyle, SkillLevel } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { defaultLocale } from '@/i18n/config';
import { db } from '@/lib/db';
import { defineQuery } from '@/server/query';

import { mediaSelect, toMediaRef, type MediaRow } from './media';

/* ─────────────────────────── Типы для компонентов ─────────────────────────── */

/** Карточка каталога: то, что нужно сетке, и ничего лишнего. */
export interface CourseCard {
  id: string;
  slug: string;
  title: string;
  description: string;
  style: DanceStyle;
  level: SkillLevel;
  price: number;
  totalMinutes: number;
  lessonsCount: number;
  instructor: { slug: string; name: string; avatar: MediaRef | null };
  cover: MediaRef | null;
}

/** Урок в программе курса. `videoKey` — ключ файла, если видео прикреплено. */
export interface CourseLessonItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  isPreview: boolean;
  videoKey: string | null;
}

export interface CourseDetail extends CourseCard {
  requirements: readonly string[];
  lessons: readonly CourseLessonItem[];
}

export interface CourseQuery {
  page?: number;
  pageSize?: number;
  style?: DanceStyle;
  level?: SkillLevel;
}

/* ─────────────────────────────── Переводы ─────────────────────────────── */

interface TranslationRow {
  locale: Locale;
  title: string;
  description: string;
}

function resolveCourseText(
  base: { title: string; description: string },
  translations: readonly TranslationRow[],
  locale: Locale,
): { title: string; description: string } {
  const found = translations.find((row) => row.locale === locale);
  if (!found) return base;
  return {
    title: found.title?.trim() ? found.title : base.title,
    description: found.description?.trim() ? found.description : base.description,
  };
}

/* ────────────────────────────── Выборки ────────────────────────────── */

const courseSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  style: true,
  level: true,
  price: true,
  totalMinutes: true,
  coverKey: true,
  translations: { select: { locale: true, title: true, description: true } },
  media: { where: { deletedAt: null }, select: mediaSelect },
  instructor: {
    select: {
      slug: true,
      user: { select: { name: true, avatarMedia: { select: mediaSelect } } },
    },
  },
  _count: { select: { lessons: { where: { deletedAt: null } } } },
} as const;

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  style: DanceStyle;
  level: SkillLevel;
  price: number;
  totalMinutes: number;
  coverKey: string | null;
  translations: TranslationRow[];
  media: MediaRow[];
  instructor: { slug: string; user: { name: string; avatarMedia: MediaRow | null } };
  _count: { lessons: number };
};

/**
 * Обложка: сначала медиатека, потом `coverKey`.
 *
 * Два источника — не дублирование, а порядок переезда: `coverKey` остался у
 * курсов, загруженных до появления медиатеки. Выбирать только новое значит
 * спрятать обложку у старых; только старое — не показать загруженную сейчас.
 */
function coverOf(row: CourseRow): MediaRef | null {
  const asset = row.media[0];
  if (asset) return toMediaRef(asset);
  if (!row.coverKey) return null;
  return { key: row.coverKey, alt: { hy: row.title, ru: row.title, en: row.title } };
}

function toCard(row: CourseRow, locale: Locale): CourseCard {
  const text = resolveCourseText(row, row.translations, locale);
  const avatarRow = row.instructor.user.avatarMedia;
  return {
    id: row.id,
    slug: row.slug,
    title: text.title,
    description: text.description,
    style: row.style,
    level: row.level,
    price: row.price,
    totalMinutes: row.totalMinutes,
    lessonsCount: row._count.lessons,
    instructor: {
      slug: row.instructor.slug,
      name: row.instructor.user.name,
      avatar: avatarRow ? toMediaRef(avatarRow) : null,
    },
    /* см. `avatarRow` — это единственный кадр пользователя, а не список. */
    cover: coverOf(row),
  };
}

/* ─────────────────────────────── Запросы ─────────────────────────────── */

/** Каталог: только опубликованные, с фильтрами по направлению и уровню. */
export const getCourseList = defineQuery({
  name: 'courseList',
  tags: () => [cacheTags.courses()],
  revalidate: dataRevalidate.catalog,
  handler: async (query: CourseQuery = {}, locale: Locale = defaultLocale): Promise<CatalogPage<CourseCard>> => {
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const pageSize = Math.min(limits.query.maxRows, Math.max(1, Math.floor(query.pageSize ?? 12)));

    const where = {
      isPublished: true,
      deletedAt: null,
      ...(query.style ? { style: query.style } : {}),
      ...(query.level ? { level: query.level } : {}),
    };

    const [total, rows] = await Promise.all([
      db.course.count({ where }),
      db.course.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        take: pageSize,
        skip: (page - 1) * pageSize,
        select: courseSelect,
      }),
    ]);

    if (total === 0) return emptyCatalogPage<CourseCard>(page, pageSize);

    return {
      items: (rows as unknown as CourseRow[]).map((row) => toCard(row, locale)),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  },
});

/** Страница курса. Неопубликованный и удалённый — `null`, то есть 404 у вызывающего. */
export const getCourseDetail = defineQuery({
  name: 'courseDetail',
  tags: (...args: unknown[]) => [cacheTags.course(String(args[0]))],
  revalidate: dataRevalidate.entity,
  handler: async (slug: string, locale: Locale = defaultLocale): Promise<CourseDetail | null> => {
    const row = (await db.course.findFirst({
      where: { slug, isPublished: true, deletedAt: null },
      select: {
        ...courseSelect,
        requirements: true,
        lessons: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }],
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            durationMinutes: true,
            isPreview: true,
            videoAssetId: true,
          },
        },
      },
    })) as unknown as (CourseRow & {
      requirements: string[];
      /** `videoAssetId` — до join'а с медиатекой; наружу уходит уже `videoKey`. */
      lessons: (Omit<CourseLessonItem, 'videoKey'> & { videoAssetId: string | null })[];
    }) | null;

    if (!row) return null;

    /*
     * Видео уроков — одним запросом на весь курс, а не по уроку: программа из
     * двадцати уроков не должна стоить двадцати обращений к базе.
     */
    const keys = row.lessons.map((lesson) => lesson.videoAssetId).filter((key): key is string => Boolean(key));
    const videos = keys.length
      ? await db.mediaAsset.findMany({ where: { storageKey: { in: keys } }, select: { storageKey: true } })
      : [];
    const existing = new Set(videos.map((asset) => asset.storageKey));

    return {
      ...toCard(row, locale),
      requirements: row.requirements,
      lessons: row.lessons.map((lesson) => ({
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        description: lesson.description,
        durationMinutes: lesson.durationMinutes,
        isPreview: lesson.isPreview,
        videoKey: lesson.videoAssetId && existing.has(lesson.videoAssetId) ? lesson.videoAssetId : null,
      })),
    };
  },
});

/** Слаги опубликованных курсов — для `generateStaticParams` и карты сайта. */
export const getCourseSlugs = defineQuery({
  name: 'courseSlugs',
  tags: () => [cacheTags.courses()],
  revalidate: dataRevalidate.catalogStats,
  handler: async (): Promise<readonly string[]> => {
    const rows = await db.course.findMany({
      where: { isPublished: true, deletedAt: null },
      select: { slug: true },
      take: limits.query.maxRows,
    });
    return rows.map((row) => row.slug);
  },
});

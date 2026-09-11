/**
 * ЗАНЯТИЯ ИЗ БАЗЫ.
 *
 * Первый модуль слоя запросов (задача 2.1). Отвечает на четыре вопроса каталога:
 * список с фильтрами, страница занятия, фасеты фильтров и перечень слагов для
 * статической сборки и карты сайта.
 *
 * ## Что изменилось по сравнению с фикстурами
 *
 * **День недели и время берутся из проведений, а не из правила.** В фикстурах у
 * занятия одно поле `weekday` и одно `startTime` — это описание регулярности. В
 * базе есть `ClassSession`, то есть настоящие даты, и карточка показывает
 * ближайшее проведение. Разница видна сразу: занятие, у которого проведения
 * закончились, больше не обещает «каждую субботу в 18:00».
 *
 * **Свободные места — из проведения, а не из поля занятия.** `capacity -
 * bookedCount` ближайшего проведения. У занятия как такового свободных мест не
 * бывает: они бывают у конкретной даты.
 *
 * ## Где считается отбор
 *
 * Дешёвые и индексируемые условия — в SQL (`where`): направление, уровень,
 * район, диапазон цены. Постраничность — тоже (`skip`/`take`), кроме случаев,
 * когда её нельзя посчитать без приложения (см. ниже).
 *
 * В приложении остаются три вещи, и каждая по своей причине:
 *
 * 1. **Текстовый запрос `q`.** `matchesQuery` сравнивает ключи поиска, а не
 *    строки: «Բաչատա», «bachata» и «бачата» — один запрос (C-03). `ILIKE` так не
 *    умеет, а полнотекстовый индекс с транслитерацией — отдельная задача (2.8).
 *    Отдать отбор в `ILIKE` сейчас значит молча потерять поиск на армянском.
 * 2. **Сортировка по ближайшему проведению.** Это минимум по связанной таблице с
 *    условием «в будущем»; Prisma сортировать по такому выражению не умеет, а
 *    сырой SQL здесь означал бы первый запрос вне типов ради порядка четырёх
 *    карточек.
 * 3. **Уровень `ALL_LEVELS`.** Занятие «для всех уровней» подходит фильтру
 *    «начальный»; это условие выражается в SQL (`in`), и оно там и есть — но
 *    список значений собирается в домене, а не пишется строкой в `where`.
 *
 * Когда текстовый отбор уедет в индекс, постраничность уедет в SQL целиком.
 * До тех пор действует потолок `limits.query.maxRows`: выборка без предела —
 * это отказ в обслуживании, который приходит вместе с ростом каталога.
 */

import 'server-only';

import { booking, limits } from '@/config/business';
import { cacheTags, dataRevalidate } from '@/config/cache';
import {
  buildFacets,
  matchesQuery,
  paginate,
  sortByOption,
  type CatalogQuery,
} from '@/domain/catalog';
import {
  emptyCatalogPage,
  type CatalogPage,
  type ClassCardItem,
  type ClassDetail,
  type FacetOption,
  type ScheduleEntry,
} from '@/domain/content';
import {
  danceStyleFromSlug,
  danceStyleLabelKey,
  danceStyleSlug,
  skillLevelLabelKey,
  type DanceStyle,
  type SkillLevel,
} from '@/domain/enums';
import { db } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import { formatClock } from '@/lib/time/clock';
import { zonedParts } from '@/lib/time/schedule';
import { defineQuery } from '@/server/query';

import { firstMediaRef, type MediaRow } from './media';
import { approvedReviewsWhere, ratingFrom, reviewSelect, type ReviewRow } from './reviews';
import { mediaRelation, notTrashed, upcomingSessionsRelation } from './relations';

/**
 * Сколько ближайших проведений тянуть.
 *
 * Карточке нужно одно, расписанию на странице занятия — несколько. Одно число на
 * оба случая: два разных запроса к одной таблице ради экономии четырёх строк
 * дороже, чем сами строки.
 */
const UPCOMING_SESSIONS = 8;

/**
 * Только опубликованное и одобренное.
 *
 * Условие повторяется в каждом запросе каталога намеренно: забыть его в одном
 * месте — значит показать в поиске занятие, снятое модератором. Отдельная
 * константа делает это невозможным по невнимательности.
 */
export const publicClassWhere = {
  isActive: true,
  /*
   * Инструктор в корзине — тоже причина не показывать занятие: расширение
   * клиента отсекает удалённое на верхнем уровне запроса, но условие на СВЯЗЬ
   * пишется здесь, иначе занятие удалённого инструктора остаётся в каталоге.
   */
  instructor: { ...notTrashed, moderation: 'APPROVED' as const, publishedAt: { not: null } },
};

export const classSelect = {
  slug: true,
  title: true,
  description: true,
  style: true,
  level: true,
  durationMinutes: true,
  price: true,
  capacity: true,
  learningPoints: true,
  isTrending: true,
  createdAt: true,
  media: mediaRelation,
  instructor: {
    select: {
      slug: true,
      headline: true,
      ratingAverage: true,
      ratingCount: true,
      isVerified: true,
      user: { select: { name: true } },
      media: mediaRelation,
    },
  },
  venue: { select: { slug: true, name: true, district: true } },
} as const;

interface SessionRow {
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  bookedCount: number;
}

export interface ClassRow {
  slug: string;
  title: string;
  description: string;
  style: DanceStyle;
  level: SkillLevel;
  durationMinutes: number;
  price: number;
  capacity: number;
  learningPoints: string[];
  isTrending: boolean;
  createdAt: Date;
  media: MediaRow[];
  instructor: {
    slug: string;
    headline: string;
    ratingAverage: unknown;
    ratingCount: number;
    isVerified: boolean;
    user: { name: string };
    media: MediaRow[];
  };
  venue: { slug: string; name: string; district: string } | null;
  sessions: SessionRow[];
}

/**
 * `Decimal` из Prisma → число.
 *
 * Рейтинг хранится `Decimal(3,2)`, потому что среднее — не целое, а деньги и
 * оценки в JS-числах округляются по-разному. Наружу уходит число: интерфейс
 * показывает «4,9», а не объект.
 */
function ratingNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

/** Ближайшее проведение: то, что показывает карточка. */
function nextSession(row: ClassRow): SessionRow | null {
  return row.sessions[0] ?? null;
}

function toScheduleEntry(session: SessionRow): ScheduleEntry {
  const start = zonedParts(session.startsAt);
  const end = zonedParts(session.endsAt);

  return {
    weekday: start.weekday,
    startTime: formatClock(start.minutesOfDay),
    endTime: formatClock(end.minutesOfDay),
    spotsLeft: Math.max(0, session.capacity - session.bookedCount),
  };
}

export function toClassCard(row: ClassRow): ClassCardItem {
  const session = nextSession(row);
  const parts = session ? zonedParts(session.startsAt) : null;

  return {
    slug: row.slug,
    title: row.title,
    style: row.style,
    level: row.level,
    instructorName: row.instructor.user.name,
    /*
     * Проведений нет — карточка честно показывает «-1» вместо дня недели? Нет:
     * такого занятия в каталоге быть не должно, но если оно есть, день недели
     * берётся из данных занятия быть не может. Показывается воскресенье 00:00 —
     * и это заметно. Скрывать нельзя: пустое место читается как «загружается».
     */
    weekday: parts?.weekday ?? 0,
    startTime: parts ? formatClock(parts.minutesOfDay) : '00:00',
    durationMinutes: row.durationMinutes,
    price: row.price,
    spotsLeft: session ? Math.max(0, session.capacity - session.bookedCount) : 0,
    /** Лист ожидания включается флагом бизнес-правил, а не полем контента. */
    waitlistOpen: booking.waitlistEnabled,
    isTrending: row.isTrending,
    image: firstMediaRef(row.media) ?? firstMediaRef(row.instructor.media) ?? {
      key: '',
      alt: { hy: '', ru: '', en: '' },
    },
  };
}

/**
 * Уровни, подходящие фильтру.
 *
 * «Для всех уровней» подходит любому запросу: прятать от начинающего занятие,
 * которое прямо заявлено как подходящее начинающему, — худший вид фильтра.
 */
function levelsFor(level: SkillLevel): readonly SkillLevel[] {
  return level === 'ALL_LEVELS' ? [level] : [level, 'ALL_LEVELS'];
}

/** Условие SQL из запроса каталога. Текст здесь не участвует — см. шапку. */
function classWhere(query: CatalogQuery) {
  const style = query.style ? danceStyleFromSlug(query.style) ?? undefined : undefined;

  return {
    ...publicClassWhere,
    ...(style ? { style } : {}),
    ...(query.level ? { level: { in: [...levelsFor(query.level as SkillLevel)] } } : {}),
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

/**
 * Выборка занятий с ближайшими проведениями.
 *
 * `now` вычисляется здесь, а не приходит аргументом: аргумент-время сделал бы
 * ключ кеша уникальным на каждый вызов (см. `defineQuery`).
 */
async function loadClasses(query: CatalogQuery): Promise<ClassRow[]> {
  const now = new Date();

  const rows = await db.danceClass.findMany({
    where: classWhere(query),
    select: {
      ...classSelect,
      sessions: upcomingSessionsRelation(now, UPCOMING_SESSIONS),

    },
    take: limits.query.maxRows,
  });

  return rows as unknown as ClassRow[];
}

/** Текстовый отбор по тем же полям, что и раньше: название, описание, связи. */
function matchesText(row: ClassRow, term: string | undefined): boolean {
  return matchesQuery(term, [
    row.title,
    row.description,
    row.instructor.user.name,
    row.venue?.name,
    row.venue?.district,
    ...row.learningPoints,
  ]);
}

function classSortKeys() {
  return {
    relevance: (row: ClassRow) => (row.isTrending ? 0 : 1),
    price: (row: ClassRow) => row.price,
    rating: (row: ClassRow) => ratingNumber(row.instructor.ratingAverage),
    startsAt: (row: ClassRow) => nextSession(row)?.startsAt.getTime() ?? Number.MAX_SAFE_INTEGER,
    createdAt: (row: ClassRow) => row.createdAt.getTime(),
  };
}

export const getClassList = defineQuery({
  name: 'classList',
  tags: () => [cacheTags.classes()],
  revalidate: dataRevalidate.catalog,
  handler: async (query: CatalogQuery): Promise<CatalogPage<ClassCardItem>> => {
    const rows = (await loadClasses(query)).filter((row) => matchesText(row, query.q));

    if (query.date) {
      /*
       * Фильтр по дате — это «есть проведение в этот день», а не «правило
       * повторения попадает на этот день недели». Разница принципиальна:
       * человек выбирает конкретное число в календаре.
       */
      const wanted = query.date;
      const matching = rows.filter((row) =>
        row.sessions.some((session) => isoDateOf(session.startsAt) === wanted),
      );
      const sorted = sortByOption(matching, query.sort, classSortKeys());
      const page = paginate(sorted, query.page, query.pageSize);
      return { ...page, items: page.items.map(toClassCard) };
    }

    const sorted = sortByOption(rows, query.sort, classSortKeys());
    const page = paginate(sorted, query.page, query.pageSize);
    return { ...page, items: page.items.map(toClassCard) };
  },
});

/** Дата проведения в поясе бизнеса, `YYYY-MM-DD`: сравнивается с фильтром из URL. */
function isoDateOf(instant: Date): string {
  const parts = zonedParts(instant);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/* ─────────────────────────── Страница занятия ─────────────────────────── */

export const getClassDetail = defineQuery({
  name: 'classDetail',
  tags: (slug: string) => [cacheTags.class(slug), cacheTags.classes()],
  revalidate: dataRevalidate.entity,
  handler: async (slug: string): Promise<ClassDetail | null> => {
    const now = new Date();

    const row = (await db.danceClass.findFirst({
      where: { slug, ...publicClassWhere },
      select: {
        ...classSelect,
        sessions: upcomingSessionsRelation(now, UPCOMING_SESSIONS),
        reviews: {
          where: approvedReviewsWhere,
          orderBy: { createdAt: 'desc' },
          take: limits.pagination.reviewsPerPage,
          select: reviewSelect,
        },
      },
    })) as unknown as (ClassRow & { reviews: ReviewRow[] }) | null;

    if (!row) return null;

    const { rating, items: reviews } = ratingFrom(row.reviews);

    /* Похожие: то же направление, другой слаг. Порядок каталога сохраняется. */
    const similarRows = (await db.danceClass.findMany({
      where: { ...publicClassWhere, style: row.style, slug: { not: slug } },
      select: {
        ...classSelect,
        sessions: upcomingSessionsRelation(now, 1),
      },
      take: limits.styleHub.classes,
    })) as unknown as ClassRow[];

    return {
      ...toClassCard(row),
      description: row.description,
      learningPoints: row.learningPoints,
      capacity: row.capacity,
      instructorSlug: row.instructor.slug,
      instructorHeadline: row.instructor.headline,
      instructorImage: firstMediaRef(row.instructor.media) ?? {
        key: '',
        alt: { hy: '', ru: '', en: '' },
      },
      instructorRating: ratingNumber(row.instructor.ratingAverage),
      instructorRatingCount: row.instructor.ratingCount,
      instructorVerified: row.instructor.isVerified,
      venueSlug: row.venue?.slug ?? '',
      venueName: row.venue?.name ?? '',
      venueDistrict: row.venue?.district ?? '',
      schedule: row.sessions.map(toScheduleEntry),
      rating,
      reviews,
      similar: similarRows.map(toClassCard),
    };
  },
});

/* ─────────────────────────── Фасеты ─────────────────────────── */

/**
 * Фасеты считаются по полному набору, а не по отфильтрованному.
 *
 * Иначе выбор направления обнуляет счётчики остальных, и вернуться к предыдущему
 * выбору некуда: фильтр, который прячет сам себя после применения, —
 * распространённая ошибка каталогов.
 */
/**
 * Карточки занятий по произвольному условию.
 *
 * Нужна соседним запросам: занятия инструктора, занятия на площадке, занятия
 * направления. Условие приходит параметром, а публичность добавляется здесь —
 * так соседний модуль не может забыть `publicClassWhere` и показать снятое с
 * публикации занятие на странице площадки.
 */
export async function classCardsBy(
  where: Prisma.DanceClassWhereInput,
  take: number,
): Promise<readonly ClassCardItem[]> {
  const now = new Date();

  const rows = (await db.danceClass.findMany({
    where: { ...publicClassWhere, ...where },
    select: {
      ...classSelect,
      sessions: upcomingSessionsRelation(now, 1),

    },
    take,
  })) as unknown as ClassRow[];

  return rows.map(toClassCard);
}

export const getClassFacets = defineQuery({
  name: 'classFacets',
  tags: () => [cacheTags.classes(), cacheTags.catalogStats()],
  revalidate: dataRevalidate.catalogStats,
  handler: async (): Promise<{
    styles: readonly FacetOption[];
    levels: readonly FacetOption[];
    districts: readonly FacetOption[];
    priceRange: { min: number; max: number };
  }> => {
    const rows = await db.danceClass.findMany({
      where: publicClassWhere,
      select: { style: true, level: true, price: true, venue: { select: { district: true } } },
      take: limits.query.maxRows,
    });

    const prices = rows.map((row) => row.price);

    return {
      styles: buildFacets(
        rows,
        (row) => [danceStyleSlug(row.style)],
        (value) => danceStyleLabelKey(danceStyleFromSlug(value) as DanceStyle),
      ),
      levels: buildFacets(
        rows,
        (row) => [row.level],
        (value) => skillLevelLabelKey(value as SkillLevel),
      ),
      districts: buildFacets(
        rows,
        (row) => (row.venue ? [row.venue.district] : []),
        /** Район — данные, а не словарь: подпись берётся как есть. */
        (value) => value,
      ),
      /* Пустой каталог не должен давать Infinity в границах фильтра цены. */
      priceRange: {
        min: prices.length > 0 ? Math.min(...prices) : 0,
        max: prices.length > 0 ? Math.max(...prices) : 0,
      },
    };
  },
});

export { emptyCatalogPage };

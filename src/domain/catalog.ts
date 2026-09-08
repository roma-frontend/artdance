/**
 * КАТАЛОГ — разбор параметров листинга, сортировка, пагинация.
 *
 * Модуль чистый: ни базы, ни фикстур, ни React. Причина в том, что именно здесь
 * живёт самая скучная и самая ломкая часть каталога — превращение строк из URL в
 * значения, которым можно доверять. `?page=-1&priceMax=abc&sort=DROP+TABLE`
 * приходит из адресной строки, то есть от кого угодно, и обязан превратиться в
 * осмысленный запрос, а не в исключение на сервере.
 *
 * Состояние фильтров живёт в URL, а не в React-состоянии. Это требование
 * продукта, а не вкусовщина: ссылка на отфильтрованный список обязана
 * открываться у другого человека и попадать в индекс поиска.
 *
 * Пагинация страничная (`?page=3`), не курсорная. Курсор дешевле для базы, но
 * страница по прямой ссылке должна открываться и индексироваться, а курсор
 * третьей страницы вне сеанса не существует.
 */

import { limits } from '@/config/business';
import type { ShopParams } from '@/config/routes';
import type { MessageKey } from '@/i18n/types';
import { keyIncludes, searchKey } from '@/lib/search/normalize';
import { danceStyleFromSlug, danceStyleSlug, skillLevels, type DanceStyle, type SkillLevel } from './enums';
import type { CatalogPage, FacetOption } from './content';

/* ──────────────────────────── Сортировка ──────────────────────────── */

export const catalogSorts = [
  'relevance',
  'priceAsc',
  'priceDesc',
  'ratingDesc',
  'soonest',
  'newest',
] as const;
export type CatalogSort = (typeof catalogSorts)[number];

export const defaultCatalogSort: CatalogSort = 'relevance';

/**
 * Ключ i18n подписи сортировки.
 *
 * Возвращаемый тип — `MessageKey`, а не `string`, и это не украшение типа.
 * Ключ собирается из шаблона, поэтому опечатка или переименование namespace
 * (`discover.sort.*` → `catalog.sort.*`) не видны ни компилятору, ни линтеру:
 * страница молча падает в рантайме на `MISSING_MESSAGE`. С `MessageKey`
 * несуществующий ключ становится ошибкой сборки — так же, как в `navigation.ts`.
 */
export function catalogSortLabelKey(sort: CatalogSort): MessageKey {
  return `catalog.sort.${sort}`;
}

function isCatalogSort(value: string): value is CatalogSort {
  return (catalogSorts as readonly string[]).includes(value);
}

/**
 * Ключи сортировки, которые листинг умеет считать.
 *
 * Каждый листинг объявляет только то, что у него есть: у товара нет даты начала,
 * у события нет рейтинга. Отсутствующий ключ означает, что вариант сортировки
 * недоступен, и интерфейс не должен его предлагать — иначе пользователь выбирает
 * порядок, который ничего не меняет, и решает, что каталог сломан.
 */
export interface SortKeys<T> {
  /** Порядок по умолчанию: чем меньше, тем выше. Обычно «трендовое сначала». */
  relevance?: (item: T) => number;
  price?: (item: T) => number;
  rating?: (item: T) => number;
  /** Время начала в миллисекундах: чем раньше, тем выше. */
  startsAt?: (item: T) => number;
  /** Время появления в каталоге в миллисекундах: чем позже, тем выше. */
  createdAt?: (item: T) => number;
}

/** Какие варианты сортировки доступны при данном наборе ключей. */
export function availableSorts<T>(keys: SortKeys<T>): readonly CatalogSort[] {
  return catalogSorts.filter((sort) => {
    switch (sort) {
      case 'relevance':
        return true;
      case 'priceAsc':
      case 'priceDesc':
        return keys.price !== undefined;
      case 'ratingDesc':
        return keys.rating !== undefined;
      case 'soonest':
        return keys.startsAt !== undefined;
      case 'newest':
        return keys.createdAt !== undefined;
    }
  });
}

/**
 * Сортировка без мутации входа.
 *
 * Порядок стабилен: при равных значениях сохраняется исходная
 * последовательность. Это важнее, чем кажется — нестабильная сортировка при
 * одинаковых ценах перемешивает страницы между запросами, и один и тот же товар
 * появляется и на второй странице, и на третьей.
 */
export function sortByOption<T>(
  items: readonly T[],
  sort: CatalogSort,
  keys: SortKeys<T>,
): readonly T[] {
  const compare = comparatorFor(sort, keys);
  if (!compare) return items;

  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compare(a.item, b.item) || a.index - b.index)
    .map((entry) => entry.item);
}

function comparatorFor<T>(
  sort: CatalogSort,
  keys: SortKeys<T>,
): ((a: T, b: T) => number) | null {
  switch (sort) {
    case 'relevance':
      return keys.relevance ? (a, b) => keys.relevance!(a) - keys.relevance!(b) : null;
    case 'priceAsc':
      return keys.price ? (a, b) => keys.price!(a) - keys.price!(b) : null;
    case 'priceDesc':
      return keys.price ? (a, b) => keys.price!(b) - keys.price!(a) : null;
    case 'ratingDesc':
      return keys.rating ? (a, b) => keys.rating!(b) - keys.rating!(a) : null;
    case 'soonest':
      return keys.startsAt ? (a, b) => keys.startsAt!(a) - keys.startsAt!(b) : null;
    case 'newest':
      return keys.createdAt ? (a, b) => keys.createdAt!(b) - keys.createdAt!(a) : null;
  }
}

/* ──────────────────────── Параметры листинга ──────────────────────── */

/**
 * Разобранный и проверенный запрос листинга.
 *
 * Поля необязательные там, где «не задано» — легальное состояние фильтра, и
 * обязательные там, где значение по умолчанию есть всегда. `undefined` в `style`
 * означает «все направления», а не «ошибка разбора»: невалидное значение
 * отбрасывается молча, потому что мусор в URL — это не повод показать 500.
 */
export interface CatalogQuery {
  q?: string;
  style?: DanceStyle;
  level?: SkillLevel;
  district?: string;
  /** Категория товара. Свободная строка: категории — контент, а не словарь домена. */
  category?: string;
  /** Дата в формате `YYYY-MM-DD`. Валидность проверена. */
  date?: string;
  priceMin?: number;
  priceMax?: number;
  sort: CatalogSort;
  page: number;
  pageSize: number;
}

/** То, что приходит в серверный компонент из `searchParams`. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Целое неотрицательное число или `undefined`.
 *
 * `Number('')` даёт ноль, а `parseInt('12abc')` даёт 12 — оба поведения здесь
 * вредны: пустой параметр это «не задано», а `12abc` это мусор.
 */
function positiveInteger(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  if (!/^\d+$/.test(raw.trim())) return undefined;
  const value = Number(raw.trim());
  return Number.isSafeInteger(value) ? value : undefined;
}

/** Дата `YYYY-MM-DD`, существующая в календаре. `2026-02-31` не проходит. */
function isoDate(raw: string | undefined): string | undefined {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  /** Проверка переполнения: `new Date('2026-02-31')` молча даёт 3 марта. */
  return parsed.toISOString().slice(0, 10) === raw ? raw : undefined;
}

export function parseCatalogQuery(params: RawSearchParams): CatalogQuery {
  const rawSort = first(params.sort);
  const rawStyle = first(params.style);
  const rawLevel = first(params.level)?.toUpperCase().replace(/-/g, '_');
  const rawQuery = first(params.q)?.trim();

  const priceMin = positiveInteger(first(params.priceMin));
  const priceMax = positiveInteger(first(params.priceMax));

  /**
   * Перевёрнутый диапазон (`priceMin=50000&priceMax=10000`) даёт гарантированно
   * пустой результат, и это выглядит как поломка каталога. Границы меняются
   * местами — пользователь получает то, что имел в виду.
   */
  const [min, max] =
    priceMin !== undefined && priceMax !== undefined && priceMin > priceMax
      ? [priceMax, priceMin]
      : [priceMin, priceMax];

  const pageSize = Math.min(
    positiveInteger(first(params.pageSize)) ?? limits.pagination.defaultPageSize,
    limits.pagination.maxPageSize,
  );

  return {
    ...(rawQuery && rawQuery.length > 0
      ? { q: rawQuery.slice(0, limits.search.maxQueryLength) }
      : {}),
    ...(rawStyle ? withStyle(rawStyle) : {}),
    ...(rawLevel && (skillLevels as readonly string[]).includes(rawLevel)
      ? { level: rawLevel as SkillLevel }
      : {}),
    ...(first(params.district)?.trim() ? { district: first(params.district)!.trim() } : {}),
    ...(first(params.category)?.trim() ? { category: first(params.category)!.trim() } : {}),
    ...(isoDate(first(params.date)) ? { date: isoDate(first(params.date))! } : {}),
    ...(min !== undefined ? { priceMin: min } : {}),
    ...(max !== undefined ? { priceMax: max } : {}),
    sort: rawSort && isCatalogSort(rawSort) ? rawSort : defaultCatalogSort,
    /** Страница считается от единицы: ноль и минус первая означают первую. */
    page: Math.max(1, positiveInteger(first(params.page)) ?? 1),
    pageSize: Math.max(1, pageSize),
  };
}

function withStyle(slug: string): { style?: DanceStyle } {
  const style = danceStyleFromSlug(slug);
  return style ? { style } : {};
}

/**
 * Активен ли хоть один фильтр.
 *
 * Сортировка и страница фильтрами не считаются: кнопка «сбросить всё» не должна
 * появляться просто потому, что человек открыл вторую страницу.
 */
export function hasActiveFilters(query: CatalogQuery): boolean {
  return (
    query.q !== undefined ||
    query.style !== undefined ||
    query.level !== undefined ||
    query.district !== undefined ||
    query.category !== undefined ||
    query.date !== undefined ||
    query.priceMin !== undefined ||
    query.priceMax !== undefined
  );
}

/** Сколько фильтров применено — для подписи `a11y.selectedFilterCount`. */
export function activeFilterCount(query: CatalogQuery): number {
  return [
    query.q,
    query.style,
    query.level,
    query.district,
    query.category,
    query.date,
    query.priceMin,
    query.priceMax,
  ].filter((value) => value !== undefined).length;
}

/**
 * Запрос обратно в параметры URL.
 *
 * Нужен ссылкам фильтров и пагинации: переключение направления обязано сохранить
 * уровень, цену и сортировку, а не сбросить их. `page` в результат не попадает
 * намеренно — смена любого фильтра возвращает на первую страницу, иначе человек
 * меняет направление и оказывается на пустой четвёртой странице нового результата.
 */
export function catalogQueryToParams(
  query: CatalogQuery,
  overrides: ShopParams = {},
): ShopParams {
  return {
    q: query.q,
    style: query.style ? danceStyleSlug(query.style) : undefined,
    level: query.level ? skillLevelSlug(query.level) : undefined,
    district: query.district,
    category: query.category,
    date: query.date,
    priceMin: query.priceMin,
    priceMax: query.priceMax,
    /** Значение по умолчанию не пишется в URL: короткая ссылка и один канонический адрес. */
    sort: query.sort === defaultCatalogSort ? undefined : query.sort,
    ...overrides,
  };
}

/** Слаг уровня для URL: `ALL_LEVELS` → `all-levels`. Обратное — в `parseCatalogQuery`. */
export function skillLevelSlug(level: SkillLevel): string {
  return level.toLowerCase().replace(/_/g, '-');
}

/* ──────────────────────────── Пагинация ──────────────────────────── */

/**
 * Отрезает страницу из полного списка.
 *
 * Запрошенная страница за пределами результата возвращается пустой, а не
 * подменяется последней: молчаливая подмена ломает совпадение `?page=` и того,
 * что на экране, а вместе с ним — канонический URL для поисковика.
 */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): CatalogPage<T> {
  const total = items.length;
  const pageCount = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    pageCount,
  };
}

/**
 * Номера страниц для отрисовки пагинации.
 *
 * Возвращает окно вокруг текущей страницы плюс всегда первую и последнюю, а
 * пропуски помечает `null`. Первая и последняя обязательны: без них с седьмой
 * страницы нельзя вернуться в начало одним нажатием, а «в конец» вообще
 * недостижим.
 *
 * @param span Сколько соседей показывать с каждой стороны от текущей.
 */
export function paginationWindow(
  page: number,
  pageCount: number,
  span = 1,
): ReadonlyArray<number | null> {
  if (pageCount <= 1) return pageCount === 1 ? [1] : [];

  const pages = new Set<number>([1, pageCount]);
  for (let offset = -span; offset <= span; offset += 1) {
    const candidate = page + offset;
    if (candidate >= 1 && candidate <= pageCount) pages.add(candidate);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | null> = [];

  for (const [index, value] of sorted.entries()) {
    const previous = sorted[index - 1];
    /** Разрыв больше единицы — пропуск; разрыв ровно в одну страницу показываем. */
    if (previous !== undefined && value - previous > 1) {
      result.push(value - previous === 2 ? value - 1 : null);
      if (value - previous === 2) {
        result.push(value);
        continue;
      }
    }
    result.push(value);
  }

  return result;
}

/* ──────────────────────────── Фасеты ──────────────────────────── */

/**
 * Считает фасеты по списку сущностей.
 *
 * Значения с нулевым счётчиком не возвращаются: фильтр, ведущий в пустой
 * результат, сообщает о своей бесполезности только после клика. Порядок —
 * по убыванию счётчика: то, чего больше, полезнее в начале списка.
 */
export function buildFacets<T>(
  items: readonly T[],
  extract: (item: T) => readonly string[],
  labelKeyFor: (value: string) => string,
): readonly FacetOption[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    for (const value of extract(item)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, labelKey: labelKeyFor(value), count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/* ──────────────────────── Текстовый поиск ──────────────────────── */

/**
 * Совпадение свободного запроса с набором полей.
 *
 * Сравниваются не строки, а их ключи поиска (`searchKey`): «Բաչատա», «bachata» и
 * «бачата» — один запрос, а «бочата» — тот же запрос с опечаткой. Логика приведения
 * живёт в `lib/search/normalize.ts` и одна на весь проект: у фильтра каталога и у
 * `/api/search` не должно быть двух разных представлений о том, что считается
 * совпадением, иначе `?q=` находит не то, что оверлей.
 *
 * Слишком короткий запрос означает «фильтр не задан» и совпадает со всем: пока
 * человек набрал одну букву, прятать от него каталог не за что.
 */
export function matchesQuery(
  query: string | undefined,
  fields: ReadonlyArray<string | undefined>,
): boolean {
  if (!query || query.length < limits.search.minQueryLength) return true;

  const needle = searchKey(query);
  if (needle.length === 0) return true;

  return fields.some(
    (field) =>
      field !== undefined && keyIncludes(searchKey(field), needle, limits.search.typo),
  );
}

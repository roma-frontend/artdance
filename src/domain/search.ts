/**
 * ПОИСК — словарь разделов и форма результата.
 *
 * Модуль лежит в домене, а не в `server/content`, по одной причине: и оверлей
 * (клиентский компонент), и `/api/search` (сервер), и страница `/discover`
 * должны говорить об областях поиска одними и теми же словами. Пока список
 * разделов жил в модуле с `import 'server-only'`, клиент не мог его прочитать —
 * и в оверлее появилась бы вторая, «своя» копия списка, которая однажды
 * разойдётся с серверной.
 *
 * Здесь нет ни запросов, ни фикстур: только словарь, ключи подписей и форма
 * ответа. Сам поиск — `searchCatalog` в `src/server/content/catalog.ts`.
 */

import { isEnabled, type FeatureKey } from '@/config/features';
import type { MessageKey } from '@/i18n/types';

/* ─────────────────────────── Области поиска ─────────────────────────── */

/**
 * Разделы, по которым ищет платформа.
 *
 * Порядок значим: он определяет и порядок чипов в оверлее, и порядок
 * переключателя на странице результатов. `all` идёт первым и выбран по
 * умолчанию — человек, открывший поиск, ещё не знает, в каком разделе лежит
 * ответ.
 *
 * `courses` в списке нет: онлайн-курсы включаются флагом поставки и появятся в
 * поиске вместе с самим модулем, а не раньше.
 */
export const searchScopes = ['all', 'classes', 'instructors', 'studios', 'events', 'products'] as const;

export type SearchScope = (typeof searchScopes)[number];

/** Раздел конкретного результата: «всё» — это запрос, а не свойство находки. */
export type SearchHitScope = Exclude<SearchScope, 'all'>;

export function isSearchScope(value: string): value is SearchScope {
  return (searchScopes as readonly string[]).includes(value);
}

/**
 * Раздел из параметра URL или тела запроса.
 *
 * Неизвестное значение — не ошибка, а мусор в адресной строке: он отбрасывается
 * до `all`, как и остальные фильтры каталога (`parseCatalogQuery`).
 */
export function parseSearchScope(value: string | string[] | undefined): SearchScope {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && isSearchScope(raw) ? raw : 'all';
}

const searchScopeI18nKeys = {
  all: 'scopeAll',
  classes: 'scopeClasses',
  instructors: 'scopeInstructors',
  studios: 'scopeStudios',
  events: 'scopeEvents',
  products: 'scopeProducts',
} as const satisfies Record<SearchScope, string>;

/**
 * Ключ подписи раздела.
 *
 * Тип — `MessageKey`, а не `string`: ключ собирается из шаблона, и без типа
 * переименование namespace `search.*` не заметит ни компилятор, ни линтер —
 * экран падает в рантайме на `MISSING_MESSAGE`. Ровно так был потерян
 * `catalog.sort.*`, и ровно так на странице `/discover` стояло приведение
 * `as 'scopeAll'`, которое молчало бы о любой опечатке.
 */
export function searchScopeLabelKey(scope: SearchScope): MessageKey {
  return `search.${searchScopeI18nKeys[scope]}`;
}

/**
 * Модуль, от которого зависит раздел поиска.
 *
 * `null` означает «часть ядра платформы»: занятия, инструкторы и залы есть в
 * любой поставке. Карта нужна в трёх местах — чипы оверлея, переключатель на
 * `/discover` и сам `searchCatalog`, — и все три обязаны решать одинаково:
 * результат, который нельзя открыть, хуже отсутствия результата.
 */
const searchScopeFeatures = {
  all: null,
  classes: null,
  instructors: null,
  studios: null,
  events: 'events',
  products: 'shop',
} as const satisfies Record<SearchScope, FeatureKey | null>;

export function isSearchScopeEnabled(scope: SearchScope): boolean {
  const feature = searchScopeFeatures[scope];
  return feature === null || isEnabled(feature);
}

/** Разделы, доступные в текущей поставке. Порядок сохраняется. */
export function enabledSearchScopes(): readonly SearchScope[] {
  return searchScopes.filter(isSearchScopeEnabled);
}

/* ─────────────────────────── Форма результата ─────────────────────────── */

/**
 * Одна строка выдачи.
 *
 * Плоская и одинаковая для всех разделов намеренно: смешанный список из карточек
 * разной формы читается как сбой вёрстки, а не как разнообразие. Раздел
 * различает бейдж, а не геометрия.
 *
 * Подписи (`title`, `subtitle`) — уже готовые строки из данных, а не ключи i18n:
 * название занятия и имя инструктора приходят из базы на языке страницы, и
 * переводить их интерфейсу нечем.
 */
export interface SearchHit {
  id: string;
  scope: SearchHitScope;
  title: string;
  /** Что под названием: инструктор, район, дата. Может быть пустой строкой. */
  subtitle: string;
  /** Путь без префикса локали: его добавит `Link` из `@/i18n/routing`. */
  href: string;
  /** Ключ изображения для `<Media>`; пустая строка — показать заглушку раздела. */
  image: string;
  /** Цена, если она у результата есть. Ноль — «бесплатно», а не «нет цены». */
  price?: number;
}

/**
 * Ответ `/api/search`.
 *
 * Запрос и раздел возвращаются вместе с находками, и это не избыточность: при
 * быстром вводе ответы приходят не в том порядке, в котором отправлены, и клиент
 * обязан уметь отбросить ответ на устаревший запрос. Сравнение с текущим полем
 * ввода — самый простой способ, не требующий счётчиков запросов.
 */
export interface SearchResponse {
  term: string;
  scope: SearchScope;
  hits: readonly SearchHit[];
}

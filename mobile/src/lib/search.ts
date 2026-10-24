import type { Entitlements } from '@/lib/entitlements';
import type { Section } from '@/lib/catalog';
import { API_URL } from '@/lib/config';

/** Совпадает с `limits.search.minQueryLength` на сервере. */
export const SEARCH_MIN_LENGTH = 2;

/** Разделы в том же порядке, что и `searchScopes` в `src/domain/search.ts`. */
export const SEARCH_SCOPES = ['all', 'classes', 'instructors', 'studios', 'events', 'products'] as const;

export type SearchScope = (typeof SEARCH_SCOPES)[number];
export type SearchHitScope = Exclude<SearchScope, 'all'>;

/** Форма строки из `/api/search`; совпадает с `SearchHit` на вебе. */
export interface SearchHit {
  id: string;
  scope: SearchHitScope;
  title: string;
  subtitle: string;
  /** Веб-путь вида `/classes/slug`. Префикс локали не нужен. */
  href: string;
  /** Ключ изображения для `mediaUri`; пустая строка — заглушка. */
  image: string;
  price?: number;
}

export interface SearchResponse {
  term: string;
  scope: SearchScope;
  hits: SearchHit[];
}

/**
 * Запрос по всем разделам сразу. Фильтр по разделу делается на клиенте, как на
 * `/discover`: счётчики у переключателя тогда считаются по одной и той же выдаче,
 * и переключение раздела не порождает новых запросов.
 */
export async function searchCatalog(term: string, locale: string, signal?: AbortSignal): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: term, locale, scope: 'all' });
  const response = await fetch(`${API_URL}/api/search?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`search failed: ${response.status}`);
  return (await response.json()) as SearchResponse;
}

export function parseSearchScope(value: string | undefined): SearchScope {
  return (SEARCH_SCOPES as readonly string[]).includes(value ?? '') ? (value as SearchScope) : 'all';
}

/**
 * Разделы, доступные в текущей поставке. До загрузки тумблеров показываем только
 * ядро платформы: раздел, которого может не быть, не должен появиться и тут же
 * исчезнуть.
 */
export function visibleSearchScopes(entitlements: Entitlements | null): SearchScope[] {
  const scopes: SearchScope[] = ['all', 'classes', 'instructors', 'studios'];
  if (entitlements?.events === true) scopes.push('events');
  if (entitlements?.shop === true) scopes.push('products');
  return scopes;
}

export function countHits(hits: readonly SearchHit[], scope: SearchScope): number {
  return scope === 'all' ? hits.length : hits.filter((hit) => hit.scope === scope).length;
}

const SECTION_BY_PATH: Partial<Record<string, Section>> = {
  classes: 'classes',
  instructors: 'instructors',
  studios: 'studios',
  events: 'events',
  shop: 'shop',
};

/**
 * Экран детали для результата. Путь `/shop/slug` открывает раздел `shop`, так же
 * как и вкладка магазина. `null` — путь, которого в приложении нет.
 */
export function hitTarget(hit: SearchHit): { section: Section; slug: string } | null {
  const parts = hit.href.split('?')[0].split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const section = SECTION_BY_PATH[parts[parts.length - 2]];
  const slug = parts[parts.length - 1];
  return section && slug ? { section, slug } : null;
}

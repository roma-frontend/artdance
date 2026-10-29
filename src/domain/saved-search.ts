/**
 * SAVED SEARCH (C-05) — сохранение поиска + алерты.
 * Запрос нормализуется (trim, lowercase) чтобы «Salsa » и «salsa» не плодили дубли.
 */

/** Границы запроса: короче двух символов — шум, длиннее 80 — не влезает в письмо и ссылку. */
export const SAVED_SEARCH_QUERY_MIN = 2;
export const SAVED_SEARCH_QUERY_MAX = 80;

/**
 * Нормализация запроса. `null` — запрос пустой или вне границ; код ошибки выбирает вызывающий.
 * Не бросаем: пустой запрос из формы должен давать 400, а не 500.
 */
export function normalizeQuery(raw: string): string | null {
  const normalized = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  if (normalized.length < SAVED_SEARCH_QUERY_MIN || normalized.length > SAVED_SEARCH_QUERY_MAX) return null;
  return normalized;
}

export function savedSearchDedupeKey(userId: string, query: string, scope: string): string {
  return `saved:${userId}:${scope}:${query}`;
}

/** Проверка совпадений раз в сутки (`growth.savedSearch.frequency`). */
export const SAVED_SEARCH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Поиски, проверенные раньше этой отметки, пора проверить снова. */
export function savedSearchDueBefore(now: Date): Date {
  return new Date(now.getTime() - SAVED_SEARCH_INTERVAL_MS);
}

/** Результаты, которых не было среди уже известных. Порядок выдачи сохраняется. */
export function newMatches<T extends { id: string }>(hits: readonly T[], knownIds: readonly string[]): T[] {
  const known = new Set(knownIds);
  return hits.filter((hit) => !known.has(hit.id));
}

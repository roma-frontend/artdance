/**
 * SAVED SEARCH (C-05) — сохранение поиска + алерты.
 * Запрос нормализуется (trim, lowercase) чтобы «Salsa » и «salsa» не плодили дубли.
 */

export function normalizeQuery(raw: string): string {
  const normalized = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  if (normalized.length < 2 || normalized.length > 80) {
    throw Object.assign(new Error('invalid query length'), { code: 'VALIDATION_FAILED', field: 'query' });
  }
  return normalized;
}

export function savedSearchDedupeKey(userId: string, query: string, scope: string): string {
  return `saved:${userId}:${scope}:${query}`;
}

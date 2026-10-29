import 'server-only';

import { growth } from '@/config/growth';
import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { normalizeQuery } from '@/domain/saved-search';
import { isSearchScope } from '@/domain/search';

const saved = { id: true, query: true, scope: true } as const;

export type SavedSearchResult = { id: string; query: string; scope: string; created: boolean };

/**
 * Сохраняет поиск. Повтор того же запроса и области возвращает существующую запись (`created: false`).
 * Лимит на пользователя: `growth.savedSearch.maxPerUser`.
 */
export async function createSavedSearch(input: { userId: string; query: string; scope?: string }): Promise<SavedSearchResult> {
  const query = normalizeQuery(input.query);
  if (!query) throw domainErrors.validationFailed('query');

  const scope = (input.scope ?? 'all').trim() || 'all';
  if (!isSearchScope(scope)) throw domainErrors.validationFailed('scope');

  const existing = await db.savedSearch.findUnique({
    where: { userId_query_scope: { userId: input.userId, query, scope } },
    select: saved,
  });
  if (existing) return { ...existing, created: false };

  const count = await db.savedSearch.count({ where: { userId: input.userId } });
  if (count >= growth.savedSearch.maxPerUser) throw domainErrors.savedSearchLimitReached();

  try {
    const row = await db.savedSearch.create({ data: { userId: input.userId, query, scope }, select: saved });
    return { ...row, created: true };
  } catch (e) {
    // Гонка двух одинаковых запросов: вторая вставка падает по уникальному ключу — отдаём победившую запись.
    if ((e as { code?: string }).code === 'P2002') {
      const winner = await db.savedSearch.findUnique({
        where: { userId_query_scope: { userId: input.userId, query, scope } },
        select: saved,
      });
      if (winner) return { ...winner, created: false };
    }
    throw e;
  }
}

export async function listSavedSearches(userId: string) {
  return db.savedSearch.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true, query: true, scope: true, createdAt: true } });
}

/** Удаляет только свою запись. Чужой или несуществующий id — `NOT_FOUND`, чужие записи не раскрываем. */
export async function deleteSavedSearch(input: { userId: string; id: string }) {
  const { count } = await db.savedSearch.deleteMany({ where: { id: input.id, userId: input.userId } });
  if (count === 0) throw domainErrors.notFound();
}

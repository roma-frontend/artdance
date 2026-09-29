import 'server-only';

import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { normalizeQuery } from '@/domain/saved-search';

export async function createSavedSearch(input: { userId: string; query: string; scope?: string }) {
  const query = normalizeQuery(input.query);
  const scope = (input.scope ?? 'all').trim() || 'all';
  try {
    return await db.savedSearch.create({ data: { userId: input.userId, query, scope }, select: { id: true, query: true, scope: true } });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') throw domainErrors.validationFailed('query');
    throw e;
  }
}

export async function listSavedSearches(userId: string) {
  return db.savedSearch.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true, query: true, scope: true, createdAt: true } });
}

export async function deleteSavedSearch(input: { userId: string; id: string }) {
  const row = await db.savedSearch.findUnique({ where: { id: input.id } });
  if (!row) throw domainErrors.notFound();
  if ((row as unknown as { userId: string }).userId !== input.userId) throw domainErrors.forbidden();
  await db.savedSearch.delete({ where: { id: input.id } });
}

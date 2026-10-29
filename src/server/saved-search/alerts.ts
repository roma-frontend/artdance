import 'server-only';

import { absoluteUrl, routes } from '@/config';
import { isSearchScope } from '@/domain/search';
import { newMatches, savedSearchDedupeKey, savedSearchDueBefore } from '@/domain/saved-search';
import { defaultLocale, isLocale, type Locale } from '@/i18n/config';
import { db } from '@/lib/db';
import { notify } from '@/lib/notifications/send';
import { searchCatalog } from '@/server/queries/search';

/** Сколько поисков проверяем за один тик. Остальные уйдут на следующих тиках (старые проверки — первыми). */
const ALERT_BATCH_SIZE = 100;
/** Сколько результатов берём на один поиск. */
const ALERT_HITS_LIMIT = 20;

type AlertRow = {
  id: string;
  userId: string;
  query: string;
  scope: string;
  checkedAt: Date | null;
  matchedIds: string[];
  user: { locale: string };
};

/**
 * Проверка сохранённых поисков (C-05). Возвращает число отправленных писем.
 * Первый прогон только запоминает текущие результаты, письмо не шлётся.
 * Ошибка по одной строке логируется и не останавливает остальные.
 */
export async function runSavedSearchAlerts(now: Date): Promise<number> {
  const rows: AlertRow[] = await db.savedSearch.findMany({
    where: {
      user: { isActive: true },
      OR: [{ checkedAt: null }, { checkedAt: { lte: savedSearchDueBefore(now) } }],
    },
    orderBy: { checkedAt: { sort: 'asc', nulls: 'first' } },
    take: ALERT_BATCH_SIZE,
    select: {
      id: true,
      userId: true,
      query: true,
      scope: true,
      checkedAt: true,
      matchedIds: true,
      user: { select: { locale: true } },
    },
  });

  let sent = 0;
  for (const row of rows) {
    try {
      if (await checkOne(row, now)) sent += 1;
    } catch (error) {
      console.error('[cron:saved-search-alerts]', error);
    }
  }
  return sent;
}

async function checkOne(row: AlertRow, now: Date): Promise<boolean> {
  const scope = row.scope;
  if (!isSearchScope(scope)) {
    // Область из старых данных, которой больше нет: помечаем проверенной и пропускаем.
    await store(row.id, row.matchedIds, now);
    return false;
  }

  const locale: Locale = isLocale(row.user.locale) ? row.user.locale : defaultLocale;
  const hits = await searchCatalog(row.query, scope, ALERT_HITS_LIMIT, locale);
  const currentIds = hits.map((hit) => hit.id);

  // Первый прогон: запоминаем базу, писем не шлём.
  if (row.checkedAt === null) {
    await store(row.id, currentIds, now);
    return false;
  }

  const fresh = newMatches(hits, row.matchedIds);
  const [first] = fresh;
  if (!first) {
    await store(row.id, currentIds, now);
    return false;
  }

  const freshIds = fresh.map((hit) => hit.id);
  // Письмо отправлено или нет (отключено, дубль, каналы выключены) — строку всё равно помечаем проверенной.
  // Выбрасывание из `notify` оставляет строку как есть, и она будет проверена в следующем тике.
  const delivered = await notify({
    userId: row.userId,
    type: 'savedSearch.match',
    locale,
    data: { query: row.query, count: fresh.length, title: first.title },
    href: absoluteUrl(`/${locale}${routes.discover({ q: row.query, scope })}`),
    dedupeKey: `${savedSearchDedupeKey(row.userId, row.query, scope)}:${freshIds.join(',')}`,
  });
  await store(row.id, currentIds, now);
  return delivered;
}

async function store(id: string, matchedIds: readonly string[], now: Date): Promise<void> {
  await db.savedSearch.update({ where: { id }, data: { matchedIds: [...matchedIds], checkedAt: now } });
}

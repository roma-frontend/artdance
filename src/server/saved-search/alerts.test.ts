import { beforeEach, describe, expect, it, vi } from 'vitest';

import { absoluteUrl, routes } from '@/config';
import { savedSearchDedupeKey, savedSearchDueBefore } from '@/domain/saved-search';
import { runSavedSearchAlerts } from '@/server/saved-search/alerts';

const h = vi.hoisted(() => ({
  savedSearch: { findMany: vi.fn(), update: vi.fn() },
  notify: vi.fn(),
  searchCatalog: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: { savedSearch: h.savedSearch } }));
vi.mock('@/lib/notifications/send', () => ({ notify: h.notify }));
vi.mock('@/server/queries/search', () => ({ searchCatalog: h.searchCatalog }));

const NOW = new Date('2026-06-10T12:00:00Z');

type Row = {
  id: string;
  userId: string;
  query: string;
  scope: string;
  checkedAt: Date | null;
  matchedIds: string[];
  user: { locale: string };
};

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: 's1',
    userId: 'u1',
    query: 'salsa',
    scope: 'classes',
    checkedAt: new Date('2026-06-09T12:00:00Z'),
    matchedIds: ['c1'],
    user: { locale: 'en' },
    ...overrides,
  };
}

function hit(id: string, title = `Title ${id}`) {
  return { id, scope: 'classes', title, subtitle: '', href: `/classes/${id}` };
}

beforeEach(() => {
  vi.resetAllMocks();
  h.savedSearch.update.mockResolvedValue({});
});

describe('runSavedSearchAlerts', () => {
  it('выбирает только активных пользователей и просроченные проверки, самые давние — первыми', async () => {
    h.savedSearch.findMany.mockResolvedValue([]);

    await expect(runSavedSearchAlerts(NOW)).resolves.toBe(0);

    expect(h.savedSearch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user: { isActive: true },
          OR: [{ checkedAt: null }, { checkedAt: { lte: savedSearchDueBefore(NOW) } }],
        },
        orderBy: { checkedAt: { sort: 'asc', nulls: 'first' } },
        take: 100,
      }),
    );
  });

  it('первый прогон запоминает текущие результаты и не шлет письмо', async () => {
    h.savedSearch.findMany.mockResolvedValue([row({ checkedAt: null, matchedIds: [] })]);
    h.searchCatalog.mockResolvedValue([hit('c1'), hit('c2')]);

    await expect(runSavedSearchAlerts(NOW)).resolves.toBe(0);

    expect(h.notify).not.toHaveBeenCalled();
    expect(h.savedSearch.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { matchedIds: ['c1', 'c2'], checkedAt: NOW },
    });
  });

  it('появились новые результаты: письмо с числом и первым заголовком, снимок обновляется', async () => {
    h.savedSearch.findMany.mockResolvedValue([row({ matchedIds: ['c1'] })]);
    h.searchCatalog.mockResolvedValue([hit('c1', 'Old'), hit('c2', 'Salsa Basics'), hit('c3', 'Salsa Night')]);
    h.notify.mockResolvedValue(true);

    await expect(runSavedSearchAlerts(NOW)).resolves.toBe(1);

    expect(h.searchCatalog).toHaveBeenCalledWith('salsa', 'classes', 20, 'en');
    expect(h.notify).toHaveBeenCalledWith({
      userId: 'u1',
      type: 'savedSearch.match',
      locale: 'en',
      data: { query: 'salsa', count: 2, title: 'Salsa Basics' },
      href: absoluteUrl(`/en${routes.discover({ q: 'salsa', scope: 'classes' })}`),
      dedupeKey: `${savedSearchDedupeKey('u1', 'salsa', 'classes')}:c2,c3`,
    });
    expect(h.savedSearch.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { matchedIds: ['c1', 'c2', 'c3'], checkedAt: NOW },
    });
  });

  it('нет новых результатов: письма нет, проверка все равно отмечается', async () => {
    h.savedSearch.findMany.mockResolvedValue([row({ matchedIds: ['c1', 'c2'] })]);
    h.searchCatalog.mockResolvedValue([hit('c2'), hit('c1')]);

    await expect(runSavedSearchAlerts(NOW)).resolves.toBe(0);

    expect(h.notify).not.toHaveBeenCalled();
    expect(h.savedSearch.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { matchedIds: ['c2', 'c1'], checkedAt: NOW },
    });
  });

  it('notify вернул false (дубликат или каналы выключены): строка все равно отмечается, счетчик не растет', async () => {
    h.savedSearch.findMany.mockResolvedValue([row({ matchedIds: [] })]);
    h.searchCatalog.mockResolvedValue([hit('c1')]);
    h.notify.mockResolvedValue(false);

    await expect(runSavedSearchAlerts(NOW)).resolves.toBe(0);

    expect(h.savedSearch.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { matchedIds: ['c1'], checkedAt: NOW },
    });
  });

  it('notify бросил исключение: строка не меняется, ошибка логируется, следующая строка обрабатывается', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.savedSearch.findMany.mockResolvedValue([
      row({ id: 's1', matchedIds: [] }),
      row({ id: 's2', userId: 'u2', matchedIds: [] }),
    ]);
    h.searchCatalog.mockResolvedValue([hit('c1')]);
    h.notify.mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce(true);

    await expect(runSavedSearchAlerts(NOW)).resolves.toBe(1);

    expect(h.savedSearch.update).toHaveBeenCalledTimes(1);
    expect(h.savedSearch.update).toHaveBeenCalledWith({
      where: { id: 's2' },
      data: { matchedIds: ['c1'], checkedAt: NOW },
    });
    expect(errorSpy).toHaveBeenCalledWith('[cron:saved-search-alerts]', expect.any(Error));
    errorSpy.mockRestore();
  });

  it('область из старых данных: поиска и письма нет, строка отмечается проверенной', async () => {
    h.savedSearch.findMany.mockResolvedValue([row({ scope: 'retired-scope', matchedIds: ['c1'] })]);

    await expect(runSavedSearchAlerts(NOW)).resolves.toBe(0);

    expect(h.searchCatalog).not.toHaveBeenCalled();
    expect(h.notify).not.toHaveBeenCalled();
    expect(h.savedSearch.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { matchedIds: ['c1'], checkedAt: NOW },
    });
  });

  it('неизвестная локаль пользователя: поиск и письмо идут на локали по умолчанию', async () => {
    h.savedSearch.findMany.mockResolvedValue([row({ matchedIds: [], user: { locale: 'de' } })]);
    h.searchCatalog.mockResolvedValue([hit('c1')]);
    h.notify.mockResolvedValue(true);

    await runSavedSearchAlerts(NOW);

    expect(h.searchCatalog).toHaveBeenCalledWith('salsa', 'classes', 20, 'hy');
    expect(h.notify).toHaveBeenCalledWith(expect.objectContaining({ locale: 'hy' }));
  });
});

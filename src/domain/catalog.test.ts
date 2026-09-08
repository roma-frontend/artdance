import { describe, expect, it } from 'vitest';

import { limits } from '@/config/business';
import {
  activeFilterCount,
  availableSorts,
  buildFacets,
  catalogQueryToParams,
  defaultCatalogSort,
  hasActiveFilters,
  matchesQuery,
  paginate,
  paginationWindow,
  parseCatalogQuery,
  sortByOption,
} from './catalog';

describe('parseCatalogQuery', () => {
  it('подставляет значения по умолчанию для пустого URL', () => {
    const query = parseCatalogQuery({});

    expect(query.sort).toBe(defaultCatalogSort);
    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(limits.pagination.defaultPageSize);
    expect(hasActiveFilters(query)).toBe(false);
  });

  it('отбрасывает мусор вместо исключения: URL приходит от кого угодно', () => {
    const query = parseCatalogQuery({
      style: 'not-a-style',
      level: 'wizard',
      sort: 'DROP TABLE',
      priceMin: 'abc',
      date: '2026-13-45',
      page: '-4',
    });

    expect(query.style).toBeUndefined();
    expect(query.level).toBeUndefined();
    expect(query.priceMin).toBeUndefined();
    expect(query.date).toBeUndefined();
    expect(query.sort).toBe(defaultCatalogSort);
    /** Отрицательная страница — это первая страница, а не ошибка. */
    expect(query.page).toBe(1);
  });

  it('разбирает слаги направления и уровня обратно в значения домена', () => {
    const query = parseCatalogQuery({ style: 'hip-hop', level: 'all-levels' });

    expect(query.style).toBe('HIP_HOP');
    expect(query.level).toBe('ALL_LEVELS');
  });

  it('меняет местами перевёрнутый диапазон цены', () => {
    const query = parseCatalogQuery({ priceMin: '50000', priceMax: '10000' });

    expect(query.priceMin).toBe(10_000);
    expect(query.priceMax).toBe(50_000);
  });

  it('отвергает несуществующую дату, а не переносит её на следующий месяц', () => {
    /** `new Date('2026-02-31')` молча даёт 3 марта — фильтр так вести себя не должен. */
    expect(parseCatalogQuery({ date: '2026-02-31' }).date).toBeUndefined();
    expect(parseCatalogQuery({ date: '2026-02-28' }).date).toBe('2026-02-28');
  });

  it('ограничивает размер страницы максимумом из бизнес-правил', () => {
    const query = parseCatalogQuery({ pageSize: '10000' });

    expect(query.pageSize).toBe(limits.pagination.maxPageSize);
  });

  it('берёт первое значение повторяющегося параметра', () => {
    const query = parseCatalogQuery({ style: ['salsa', 'ballet'] });

    expect(query.style).toBe('SALSA');
  });

  it('обрезает слишком длинный запрос вместо отказа', () => {
    const query = parseCatalogQuery({ q: 'x'.repeat(limits.search.maxQueryLength + 50) });

    expect(query.q).toHaveLength(limits.search.maxQueryLength);
  });

  it('не считает сортировку и страницу фильтрами', () => {
    const query = parseCatalogQuery({ sort: 'priceAsc', page: '3' });

    expect(hasActiveFilters(query)).toBe(false);
    expect(activeFilterCount(query)).toBe(0);
  });

  it('считает применённые фильтры для подписи доступности', () => {
    const query = parseCatalogQuery({ style: 'salsa', level: 'beginner', priceMax: '15000' });

    expect(activeFilterCount(query)).toBe(3);
  });
});

describe('catalogQueryToParams', () => {
  it('сохраняет остальные фильтры при переключении одного', () => {
    const query = parseCatalogQuery({ style: 'salsa', level: 'beginner', sort: 'priceAsc' });
    const params = catalogQueryToParams(query, { style: 'ballet' });

    expect(params.style).toBe('ballet');
    expect(params.level).toBe('beginner');
    expect(params.sort).toBe('priceAsc');
  });

  it('не пишет сортировку по умолчанию в URL: один канонический адрес', () => {
    const params = catalogQueryToParams(parseCatalogQuery({ style: 'salsa' }));

    expect(params.sort).toBeUndefined();
  });

  it('не переносит номер страницы: смена фильтра возвращает к началу', () => {
    const params = catalogQueryToParams(parseCatalogQuery({ page: '5', style: 'salsa' }));

    expect(params.page).toBeUndefined();
  });
});

describe('sortByOption', () => {
  const items = [
    { name: 'b', price: 200, rating: 4 },
    { name: 'a', price: 100, rating: 5 },
    { name: 'c', price: 200, rating: 3 },
  ];
  const keys = { price: (item: (typeof items)[number]) => item.price };

  it('сортирует по цене в обе стороны', () => {
    expect(sortByOption(items, 'priceAsc', keys).map((i) => i.name)).toEqual(['a', 'b', 'c']);
    expect(sortByOption(items, 'priceDesc', keys).map((i) => i.name)).toEqual(['b', 'c', 'a']);
  });

  it('стабильна при равных значениях: страницы не перемешиваются между запросами', () => {
    const sorted = sortByOption(items, 'priceAsc', keys);

    expect(sorted.map((i) => i.name)).toEqual(['a', 'b', 'c']);
    expect(sortByOption(sorted, 'priceAsc', keys).map((i) => i.name)).toEqual(['a', 'b', 'c']);
  });

  it('не мутирует вход', () => {
    const original = [...items];
    sortByOption(items, 'priceDesc', keys);

    expect(items).toEqual(original);
  });

  it('оставляет порядок как есть, если ключа для сортировки нет', () => {
    const sorted = sortByOption(items, 'ratingDesc', keys);

    expect(sorted.map((i) => i.name)).toEqual(['b', 'a', 'c']);
  });
});

describe('availableSorts', () => {
  it('предлагает только те варианты, которые листинг умеет считать', () => {
    const sorts = availableSorts<{ price: number }>({ price: (item) => item.price });

    expect(sorts).toContain('priceAsc');
    expect(sorts).toContain('relevance');
    expect(sorts).not.toContain('ratingDesc');
    expect(sorts).not.toContain('soonest');
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, index) => index);

  it('считает страницы от единицы, как в URL', () => {
    const page = paginate(items, 1, 10);

    expect(page.items).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(page.pageCount).toBe(3);
    expect(page.total).toBe(25);
  });

  it('возвращает пустую страницу за пределами результата, а не подменяет последней', () => {
    const page = paginate(items, 99, 10);

    expect(page.items).toEqual([]);
    expect(page.page).toBe(99);
    expect(page.pageCount).toBe(3);
  });

  it('у пустого результата ноль страниц', () => {
    expect(paginate([], 1, 10).pageCount).toBe(0);
  });
});

describe('paginationWindow', () => {
  it('показывает первую, последнюю и соседей текущей', () => {
    expect(paginationWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
  });

  it('вместо пропуска в одну страницу показывает саму страницу', () => {
    expect(paginationWindow(4, 10)).toEqual([1, 2, 3, 4, 5, null, 10]);
  });

  it('обходится без пропусков на коротком списке', () => {
    expect(paginationWindow(2, 3)).toEqual([1, 2, 3]);
  });

  it('пустой результат и одна страница пагинации не требуют', () => {
    expect(paginationWindow(1, 0)).toEqual([]);
    expect(paginationWindow(1, 1)).toEqual([1]);
  });

  it('не выходит за границы у последней страницы', () => {
    expect(paginationWindow(10, 10)).toEqual([1, null, 9, 10]);
  });
});

describe('buildFacets', () => {
  const items = [{ tags: ['a', 'b'] }, { tags: ['a'] }, { tags: ['c'] }];

  it('считает вхождения и сортирует по убыванию', () => {
    const facets = buildFacets(items, (item) => item.tags, (value) => `label.${value}`);

    expect(facets[0]).toEqual({ value: 'a', labelKey: 'label.a', count: 2 });
    expect(facets).toHaveLength(3);
  });

  it('не возвращает значения с нулём: фильтр в пустоту бесполезен', () => {
    const facets = buildFacets(items, (item) => item.tags, (value) => value);

    expect(facets.every((facet) => facet.count > 0)).toBe(true);
    expect(facets.map((facet) => facet.value)).not.toContain('z');
  });
});

describe('matchesQuery', () => {
  it('пропускает всё, пока запрос короче минимума', () => {
    expect(matchesQuery('a', ['Latin Fusion'])).toBe(true);
    expect(matchesQuery(undefined, ['Latin Fusion'])).toBe(true);
  });

  it('сравнивает без регистра и диакритики', () => {
    expect(matchesQuery('latin', ['Latin Fusion'])).toBe(true);
    expect(matchesQuery('náre', ['Nare Grigoryan'])).toBe(true);
  });

  it('ищет по любому из полей и не спотыкается на пустых', () => {
    expect(matchesQuery('salsa', [undefined, 'Salsa Basics'])).toBe(true);
    expect(matchesQuery('tango', [undefined, 'Salsa Basics'])).toBe(false);
  });
});

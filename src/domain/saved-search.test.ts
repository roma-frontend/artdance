import { describe, expect, it } from 'vitest';

import {
  SAVED_SEARCH_INTERVAL_MS,
  SAVED_SEARCH_QUERY_MAX,
  SAVED_SEARCH_QUERY_MIN,
  newMatches,
  normalizeQuery,
  savedSearchDedupeKey,
  savedSearchDueBefore,
} from '@/domain/saved-search';

const HOUR_MS = 60 * 60 * 1000;

describe('normalizeQuery', () => {
  it('убирает пробелы по краям, схлопывает внутренние и приводит к нижнему регистру', () => {
    expect(normalizeQuery('  Salsa   Cuban  ')).toBe('salsa cuban');
  });

  it('«Salsa » и «salsa» дают один и тот же запрос', () => {
    expect(normalizeQuery('Salsa ')).toBe(normalizeQuery('salsa'));
  });

  it('приводит кириллицу к нижнему регистру', () => {
    expect(normalizeQuery('ТАНГО')).toBe('танго');
  });

  it('пустой запрос и запрос из одних пробелов дают null, без исключения', () => {
    expect(normalizeQuery('')).toBeNull();
    expect(normalizeQuery('   \t  ')).toBeNull();
  });

  it('короче минимума и длиннее максимума дают null', () => {
    expect(normalizeQuery('a'.repeat(SAVED_SEARCH_QUERY_MIN - 1))).toBeNull();
    expect(normalizeQuery('a'.repeat(SAVED_SEARCH_QUERY_MAX + 1))).toBeNull();
  });

  it('границы минимума и максимума допустимы', () => {
    expect(normalizeQuery('a'.repeat(SAVED_SEARCH_QUERY_MIN))).toBe('a'.repeat(SAVED_SEARCH_QUERY_MIN));
    expect(normalizeQuery('a'.repeat(SAVED_SEARCH_QUERY_MAX))).toBe('a'.repeat(SAVED_SEARCH_QUERY_MAX));
  });

  it('длина проверяется после нормализации: обрамляющие пробелы не считаются', () => {
    const padded = `   ${'a'.repeat(SAVED_SEARCH_QUERY_MIN)}   `;
    expect(normalizeQuery(padded)).toBe('a'.repeat(SAVED_SEARCH_QUERY_MIN));
  });
});

describe('savedSearchDedupeKey', () => {
  it('ключ включает пользователя, область и запрос', () => {
    expect(savedSearchDedupeKey('u1', 'salsa', 'classes')).toBe('saved:u1:classes:salsa');
  });

  it('одинаковый запрос в разных областях дает разные ключи', () => {
    expect(savedSearchDedupeKey('u1', 'salsa', 'classes')).not.toBe(savedSearchDedupeKey('u1', 'salsa', 'all'));
  });
});

describe('savedSearchDueBefore', () => {
  it('граница отстоит от момента проверки ровно на сутки', () => {
    const now = new Date('2026-06-10T12:00:00Z');

    expect(SAVED_SEARCH_INTERVAL_MS).toBe(24 * HOUR_MS);
    expect(savedSearchDueBefore(now).getTime()).toBe(now.getTime() - 24 * HOUR_MS);
  });

  it('проверка 23 часа назад ещё не просрочена, 25 часов назад — просрочена', () => {
    const now = new Date('2026-06-10T12:00:00Z');
    const cutoff = savedSearchDueBefore(now).getTime();
    const checkedTwentyThreeHoursAgo = now.getTime() - 23 * HOUR_MS;
    const checkedTwentyFiveHoursAgo = now.getTime() - 25 * HOUR_MS;

    expect(checkedTwentyThreeHoursAgo <= cutoff).toBe(false);
    expect(checkedTwentyFiveHoursAgo <= cutoff).toBe(true);
  });
});

describe('newMatches', () => {
  const hits = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('возвращает результаты, которых не было среди известных, в исходном порядке', () => {
    expect(newMatches(hits, ['b'])).toEqual([{ id: 'a' }, { id: 'c' }]);
  });

  it('если все результаты известны, новых нет', () => {
    expect(newMatches(hits, ['a', 'b', 'c'])).toEqual([]);
  });

  it('пустой снимок: все результаты новые', () => {
    expect(newMatches(hits, [])).toEqual(hits);
  });

  it('не меняет входные массивы', () => {
    const known = ['a'];

    newMatches(hits, known);

    expect(known).toEqual(['a']);
    expect(hits).toHaveLength(3);
  });
});

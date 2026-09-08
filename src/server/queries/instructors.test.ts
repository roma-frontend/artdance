/**
 * Порядок инструкторов в листинге.
 *
 * Проверяется не «работает ли запрос», а то, что порядок задаёт
 * `domain/ranking.ts`, а не формула по месту: расхождение между каталогом и
 * подборками означало бы две разные политики распределения броней между людьми.
 *
 * Данные строятся здесь, а не берутся из базы: тест, зависящий от того, что
 * лежит в базе разработчика, проверяет состояние базы, а не код.
 */

import { describe, expect, it } from 'vitest';

import { sortByOption } from '@/domain/catalog';
import { computeRankingScore } from '@/domain/ranking';

import { instructorSortKeys, rankingSignals, type InstructorRankingRow } from './instructors';

const now = new Date('2026-09-08T12:00:00Z');
const longAgo = new Date('2020-01-01T00:00:00Z');

function row(overrides: Partial<InstructorRankingRow> & { slug?: string }): InstructorRankingRow & {
  slug: string;
} {
  return {
    slug: overrides.slug ?? 'anon',
    ratingAverage: 4.5,
    ratingCount: 20,
    studentCount: 50,
    createdAt: longAgo,
    isVerified: false,
    hourlyRateFrom: 10_000,
    ...overrides,
  };
}

describe('сигналы ранжирования', () => {
  it('оценка приходит числом даже из Decimal', () => {
    /* Prisma отдаёт Decimal объектом: без приведения счёт считался бы от NaN. */
    const signals = rankingSignals(row({ ratingAverage: { toString: () => '4.75' } }));
    expect(signals.averageRating).toBeCloseTo(4.75);
  });

  it('пустая оценка — это ноль, а не NaN', () => {
    expect(rankingSignals(row({ ratingAverage: null })).averageRating).toBe(0);
  });

  it('число учеников подменяет проведённые брони', () => {
    expect(rankingSignals(row({ studentCount: 120 })).completedBookings).toBe(120);
  });

  it('сигналы без данных приходят нулями, а не выдуманными значениями', () => {
    const signals = rankingSignals(row({}));
    expect(signals.fillRate).toBe(0);
    expect(signals.responseTimeMinutes).toBe(0);
    expect(signals.cancellationRate).toBe(0);
    expect(signals.noShowRate).toBe(0);
  });

  it('платного размещения нет: буст всегда пуст', () => {
    expect(rankingSignals(row({})).boostedUntil).toBeNull();
  });

  it('дата регистрации настоящая — поддержка новичка может примениться', () => {
    const fresh = new Date('2026-09-01T00:00:00Z');
    expect(rankingSignals(row({ createdAt: fresh })).createdAt).toEqual(fresh);
  });
});

describe('порядок листинга', () => {
  const rows = [
    row({ slug: 'weak', ratingAverage: 3.8, ratingCount: 4, studentCount: 5 }),
    row({ slug: 'strong', ratingAverage: 4.9, ratingCount: 180, studentCount: 400, isVerified: true }),
    row({ slug: 'middle', ratingAverage: 4.5, ratingCount: 40, studentCount: 90 }),
  ];

  it('совпадает со счётом ранжирования', () => {
    const listed = sortByOption(rows, 'relevance', instructorSortKeys(now)).map((item) => item.slug);

    const expected = [...rows]
      .map((item) => ({ slug: item.slug, score: computeRankingScore(rankingSignals(item), now) }))
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.slug);

    expect(listed).toEqual(expected);
  });

  it('проверенный не оказывается ниже непроверенного при прочих равных', () => {
    const pair = [
      row({ slug: 'plain', isVerified: false }),
      row({ slug: 'verified', isVerified: true }),
    ];
    const listed = sortByOption(pair, 'relevance', instructorSortKeys(now)).map((item) => item.slug);
    expect(listed[0]).toBe('verified');
  });

  it('сортировка по цене идёт от дешёвой к дорогой', () => {
    const pair = [row({ slug: 'pricey', hourlyRateFrom: 30_000 }), row({ slug: 'cheap', hourlyRateFrom: 8_000 })];
    const listed = sortByOption(pair, 'priceAsc', instructorSortKeys(now)).map((item) => item.slug);
    expect(listed).toEqual(['cheap', 'pricey']);
  });

  it('сортировка «новые» ставит зарегистрированных позже выше', () => {
    const pair = [
      row({ slug: 'old', createdAt: longAgo }),
      row({ slug: 'new', createdAt: new Date('2026-08-01T00:00:00Z') }),
    ];
    const listed = sortByOption(pair, 'newest', instructorSortKeys(now)).map((item) => item.slug);
    expect(listed).toEqual(['new', 'old']);
  });

  it('порядок по релевантности не зависит от даты запуска', () => {
    const early = sortByOption(rows, 'relevance', instructorSortKeys(new Date('2026-01-01T00:00:00Z')));
    const late = sortByOption(rows, 'relevance', instructorSortKeys(new Date('2027-01-01T00:00:00Z')));
    expect(early.map((item) => item.slug)).toEqual(late.map((item) => item.slug));
  });
});

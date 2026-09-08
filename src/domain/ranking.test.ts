/**
 * Тесты ранжирования. Обязательны по конвенциям: порядок выдачи определяет, кто
 * получит бронь, то есть это распределение денег между исполнителями.
 *
 * Проверяются не абсолютные числа (они зависят от весов и меняются вместе с
 * коммерческим решением), а свойства формулы: что она монотонна по каждому
 * сигналу, что объём отзывов важнее одиночной пятёрки, что новичок не закопан и
 * что буст виден отдельной строкой.
 */

import { describe, expect, it } from 'vitest';

import { ranking } from '@/config/ranking';

import {
  computeRankingScore,
  isBoosted,
  newcomerBonus,
  rankingBreakdown,
  relevanceKey,
  type RankingSignals,
} from './ranking';

const utc = (iso: string): Date => new Date(iso);

/** Вторник 8 сентября 2026 — точка «сейчас» во всех тестах. */
const now = utc('2026-09-08T12:00:00Z');

/** Зрелый исполнитель со средними показателями: база для сравнений. */
function signals(overrides: Partial<RankingSignals> = {}): RankingSignals {
  return {
    averageRating: 4.5,
    reviewCount: 40,
    fillRate: 0.7,
    responseTimeMinutes: 60,
    cancellationRate: 0.02,
    noShowRate: 0,
    completedBookings: 60,
    /** Год на платформе: поддержка новичка не действует. */
    createdAt: utc('2025-09-08T12:00:00Z'),
    isVerified: true,
    boostedUntil: null,
    ...overrides,
  };
}

describe('веса', () => {
  it('сумма весов равна 100: шкала счёта предсказуема', () => {
    const total = Object.values(ranking.weights).reduce((sum, value) => sum + value, 0);

    expect(total).toBe(100);
  });

  it('надёжность весит больше опыта и проверки: сорванная бронь дороже стажа', () => {
    expect(ranking.weights.reliability).toBeGreaterThan(ranking.weights.experience);
    expect(ranking.weights.reliability).toBeGreaterThan(ranking.weights.verification);
  });
});

describe('computeRankingScore — границы шкалы', () => {
  it('базовый счёт не превышает 100 и приближается к нему с ростом числа отзывов', () => {
    /*
     * Ровно 100 недостижимо, и это следствие сглаживания, а не ошибка: средняя
     * оценка тянется к приору тем слабее, чем больше отзывов, но полностью
     * освободиться от него не может. Свойство, которое обязано держаться —
     * потолок 100 и монотонное приближение к нему.
     */
    const perfect = (reviewCount: number) =>
      signals({
        averageRating: 5,
        reviewCount,
        fillRate: 1,
        responseTimeMinutes: 0,
        cancellationRate: 0,
        noShowRate: 0,
        completedBookings: ranking.experienceSaturationBookings * 2,
        isVerified: true,
      });

    const few = computeRankingScore(perfect(ranking.reviewConfidenceCount), now);
    const many = computeRankingScore(perfect(ranking.reviewConfidenceCount * 100), now);

    expect(many).toBeLessThanOrEqual(100);
    expect(many).toBeGreaterThan(few);
    expect(many).toBeGreaterThan(99);
  });

  it('худшие показатели не уходят ниже нуля', () => {
    const worst = signals({
      averageRating: 1,
      reviewCount: 500,
      fillRate: 0,
      responseTimeMinutes: 10_000,
      cancellationRate: 1,
      noShowRate: 1,
      completedBookings: 0,
      isVerified: false,
    });

    expect(computeRankingScore(worst, now)).toBeGreaterThanOrEqual(0);
  });

  it('мусор в сигналах не превращается в NaN', () => {
    const broken = signals({ fillRate: Number.NaN, responseTimeMinutes: Number.NaN });

    expect(Number.isFinite(computeRankingScore(broken, now))).toBe(true);
  });
});

describe('оценка сглаживается по числу отзывов', () => {
  it('4.9 по сотне отзывов выше 5.0 по двум', () => {
    const established = computeRankingScore(
      signals({ averageRating: 4.9, reviewCount: 100 }),
      now,
    );
    const lucky = computeRankingScore(signals({ averageRating: 5, reviewCount: 2 }), now);

    expect(established).toBeGreaterThan(lucky);
  });

  it('без отзывов оценка считается средней по платформе, а не худшей', () => {
    const noReviews = rankingBreakdown(signals({ averageRating: 0, reviewCount: 0 }), now);
    const badReviews = rankingBreakdown(signals({ averageRating: 1, reviewCount: 100 }), now);

    expect(noReviews.signals.rating).toBeGreaterThan(badReviews.signals.rating);
  });

  it('один плохой отзыв не закапывает исполнителя', () => {
    const oneBad = rankingBreakdown(signals({ averageRating: 1, reviewCount: 1 }), now);
    const manyBad = rankingBreakdown(signals({ averageRating: 1, reviewCount: 50 }), now);

    expect(oneBad.signals.rating).toBeGreaterThan(manyBad.signals.rating * 2);
  });

  it('счёт растёт вместе с оценкой при равном числе отзывов', () => {
    const lower = computeRankingScore(signals({ averageRating: 4.0 }), now);
    const higher = computeRankingScore(signals({ averageRating: 4.8 }), now);

    expect(higher).toBeGreaterThan(lower);
  });
});

describe('надёжность', () => {
  it('отмены опускают счёт', () => {
    const reliable = computeRankingScore(signals({ cancellationRate: 0 }), now);
    const flaky = computeRankingScore(signals({ cancellationRate: 0.3 }), now);

    expect(flaky).toBeLessThan(reliable);
  });

  it('неявка наказывается сильнее отмены той же доли', () => {
    const cancelled = computeRankingScore(signals({ cancellationRate: 0.2, noShowRate: 0 }), now);
    const noShow = computeRankingScore(signals({ cancellationRate: 0, noShowRate: 0.2 }), now);

    expect(noShow).toBeLessThan(cancelled);
  });

  it('полная ненадёжность обнуляет сигнал, но не счёт целиком', () => {
    const breakdown = rankingBreakdown(signals({ cancellationRate: 1, noShowRate: 1 }), now);

    expect(breakdown.signals.reliability).toBe(0);
    expect(breakdown.base).toBeGreaterThan(0);
  });
});

describe('остальные сигналы монотонны', () => {
  it('заполняемость', () => {
    expect(computeRankingScore(signals({ fillRate: 0.9 }), now)).toBeGreaterThan(
      computeRankingScore(signals({ fillRate: 0.3 }), now),
    );
  });

  it('скорость ответа', () => {
    expect(computeRankingScore(signals({ responseTimeMinutes: 15 }), now)).toBeGreaterThan(
      computeRankingScore(signals({ responseTimeMinutes: 600 }), now),
    );
  });

  it('сутки без ответа обнуляют сигнал отзывчивости', () => {
    const silent = rankingBreakdown(
      signals({ responseTimeMinutes: ranking.responseTimeCeilingMinutes }),
      now,
    );

    expect(silent.signals.responsiveness).toBe(0);
  });

  it('опыт', () => {
    expect(computeRankingScore(signals({ completedBookings: 100 }), now)).toBeGreaterThan(
      computeRankingScore(signals({ completedBookings: 5 }), now),
    );
  });

  it('проверка документов', () => {
    expect(computeRankingScore(signals({ isVerified: true }), now)).toBeGreaterThan(
      computeRankingScore(signals({ isVerified: false }), now),
    );
  });
});

describe('newcomerBonus', () => {
  it('в день появления бонус максимальный', () => {
    expect(newcomerBonus(now, now)).toBeCloseTo(ranking.newcomer.maxBonus, 5);
  });

  it('к середине окна остаётся половина', () => {
    const half = new Date(
      now.getTime() - (ranking.newcomer.windowDays / 2) * 24 * 60 * 60 * 1_000,
    );

    expect(newcomerBonus(half, now)).toBeCloseTo(ranking.newcomer.maxBonus / 2, 5);
  });

  it('по истечении окна бонуса нет', () => {
    const expired = new Date(
      now.getTime() - ranking.newcomer.windowDays * 24 * 60 * 60 * 1_000,
    );

    expect(newcomerBonus(expired, now)).toBe(0);
  });

  it('убывает без ступеньки: разница за сутки меньше самого бонуса', () => {
    const day = 24 * 60 * 60 * 1_000;
    const at29 = newcomerBonus(new Date(now.getTime() - 29 * day), now);
    const at30 = newcomerBonus(new Date(now.getTime() - 30 * day), now);

    expect(at29).toBeGreaterThan(0);
    expect(at29 - at30).toBeLessThan(ranking.newcomer.maxBonus / 2);
  });

  it('дата в будущем — ошибка данных, а не максимальный бонус', () => {
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1_000);

    expect(newcomerBonus(future, now)).toBe(0);
  });

  it('неизвестная дата регистрации не даёт бонуса', () => {
    expect(newcomerBonus(null, now)).toBe(0);
  });

  it('новичок без отзывов не оказывается ниже давнего исполнителя без отзывов', () => {
    const blank = { averageRating: 0, reviewCount: 0, completedBookings: 0, fillRate: 0 };
    const newbie = computeRankingScore(signals({ ...blank, createdAt: now }), now);
    const veteran = computeRankingScore(signals({ ...blank }), now);

    expect(newbie).toBeGreaterThan(veteran);
  });
});

describe('платное продвижение', () => {
  it('активный буст добавляется отдельной строкой, а не растворяется в счёте', () => {
    const boosted = rankingBreakdown(
      signals({ boostedUntil: utc('2026-09-30T00:00:00Z') }),
      now,
    );
    const plain = rankingBreakdown(signals(), now);

    expect(boosted.boostedBonus).toBe(ranking.boostedBonus);
    expect(boosted.base).toBeCloseTo(plain.base, 5);
    expect(boosted.total - plain.total).toBeCloseTo(ranking.boostedBonus, 5);
  });

  it('истёкший буст не действует', () => {
    expect(isBoosted(utc('2026-09-01T00:00:00Z'), now)).toBe(false);
    expect(rankingBreakdown(signals({ boostedUntil: utc('2026-09-01T00:00:00Z') }), now)
      .boostedBonus).toBe(0);
  });

  it('отсутствие буста — не ошибка', () => {
    expect(isBoosted(null, now)).toBe(false);
  });
});

describe('rankingBreakdown', () => {
  it('сумма вкладов равна базовому счёту', () => {
    const breakdown = rankingBreakdown(signals(), now);
    const sum = Object.values(breakdown.signals).reduce((total, value) => total + value, 0);

    expect(sum).toBeCloseTo(breakdown.base, 10);
  });

  it('итог складывается из базы и бонусов', () => {
    const breakdown = rankingBreakdown(
      signals({ createdAt: now, boostedUntil: utc('2026-10-01T00:00:00Z') }),
      now,
    );

    expect(breakdown.total).toBeCloseTo(
      breakdown.base + breakdown.newcomerBonus + breakdown.boostedBonus,
      10,
    );
  });

  it('ни один вклад не превышает свой вес', () => {
    const breakdown = rankingBreakdown(
      signals({
        averageRating: 5,
        reviewCount: 1_000,
        fillRate: 2,
        responseTimeMinutes: -10,
        completedBookings: 10_000,
      }),
      now,
    );

    for (const [name, value] of Object.entries(breakdown.signals)) {
      expect(value, name).toBeLessThanOrEqual(
        ranking.weights[name as keyof typeof ranking.weights],
      );
    }
  });
});

describe('relevanceKey', () => {
  it('инвертирует счёт: сортировка по возрастанию ставит лучших первыми', () => {
    const strong = signals({ averageRating: 4.9, reviewCount: 200 });
    const weak = signals({ averageRating: 3.5, reviewCount: 200 });

    expect(relevanceKey(strong, now)).toBeLessThan(relevanceKey(weak, now));
  });

  it('равные сигналы дают равный ключ: порядок решает стабильная сортировка', () => {
    expect(relevanceKey(signals(), now)).toBe(relevanceKey(signals(), now));
  });
});

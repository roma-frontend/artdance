import { describe, expect, it } from 'vitest';

import { athleteRating, placePoints, ratingWindowStart } from './athlete-rating';

const now = new Date('2026-11-01T12:00:00Z');

describe('athleteRating', () => {
  it('сумма баллов за места в окне', () => {
    const rating = athleteRating(
      [
        { place: 'GOLD', eventStartsAt: new Date('2026-06-01T10:00:00Z') },
        { place: 'PARTICIPANT', eventStartsAt: new Date('2026-03-01T10:00:00Z') },
      ],
      now,
    );

    expect(rating).toBe(placePoints.GOLD + placePoints.PARTICIPANT);
  });

  it('результат старше окна в рейтинг не входит', () => {
    const rating = athleteRating([{ place: 'GOLD', eventStartsAt: new Date('2023-01-01T10:00:00Z') }], now);

    expect(rating).toBe(0);
  });

  it('соревнование в будущем результатом не считается', () => {
    const rating = athleteRating([{ place: 'GOLD', eventStartsAt: new Date('2026-12-01T10:00:00Z') }], now);

    expect(rating).toBe(0);
  });

  it('окно начинается ровно за 24 месяца', () => {
    const from = ratingWindowStart(now);

    expect(from.toISOString().slice(0, 10)).toBe('2024-11-01');
  });
});

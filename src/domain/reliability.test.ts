import { describe, expect, it } from 'vitest';

import { isLateCancellation } from '@/domain/reliability';

const HOUR = 60 * 60 * 1000;
const startsAt = new Date('2026-10-03T14:00:00Z');

describe('поздняя отмена (D-07)', () => {
  it('за 5 часов до старта при окне 24 ч отмена поздняя', () => {
    expect(isLateCancellation({ now: new Date(startsAt.getTime() - 5 * HOUR), startsAt, cancellationWindowHours: 24 })).toBe(true);
  });

  it('ровно за окно до старта отмена ещё бесплатная', () => {
    expect(isLateCancellation({ now: new Date(startsAt.getTime() - 24 * HOUR), startsAt, cancellationWindowHours: 24 })).toBe(false);
  });

  it('за 25 часов до старта отмена бесплатная', () => {
    expect(isLateCancellation({ now: new Date(startsAt.getTime() - 25 * HOUR), startsAt, cancellationWindowHours: 24 })).toBe(false);
  });

  it('после начала занятия отмена не считается поздней: её отклоняет политика отмены', () => {
    expect(isLateCancellation({ now: new Date(startsAt.getTime() + HOUR), startsAt, cancellationWindowHours: 24 })).toBe(false);
  });
});

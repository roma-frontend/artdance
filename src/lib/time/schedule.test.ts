import { describe, expect, it } from 'vitest';

import { site } from '@/config/site';

import { fromZonedParts, isoDateFallsOnWeekday, nextOccurrence, zonedParts } from './schedule';

/**
 * Момент времени задаётся в UTC явной строкой: тест не должен зависеть от
 * часового пояса машины, на которой он запущен. Ереван — UTC+4 круглый год
 * (перехода на летнее время нет с 2012 года).
 */
const utc = (iso: string): Date => new Date(iso);

describe('zonedParts', () => {
  it('переводит момент в календарные части часового пояса бизнеса', () => {
    /** 14:00 UTC — это 18:00 в Ереване. */
    const parts = zonedParts(utc('2026-09-12T14:00:00.000Z'));

    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(9);
    expect(parts.day).toBe(12);
    expect(parts.minutesOfDay).toBe(18 * 60);
    /** 12 сентября 2026 — суббота. */
    expect(parts.weekday).toBe(6);
  });

  it('переносит дату вперёд, когда пояс перешагивает полночь', () => {
    /** 21:00 UTC — это 01:00 следующего дня в Ереване. */
    const parts = zonedParts(utc('2026-09-12T21:00:00.000Z'));

    expect(parts.day).toBe(13);
    expect(parts.minutesOfDay).toBe(60);
  });
});

describe('fromZonedParts', () => {
  it('обратна zonedParts', () => {
    const instant = fromZonedParts({ year: 2026, month: 9, day: 12, minutesOfDay: 18 * 60 });

    expect(instant.toISOString()).toBe('2026-09-12T14:00:00.000Z');
  });

  it('не зависит от часового пояса машины', () => {
    const instant = fromZonedParts({ year: 2026, month: 1, day: 1, minutesOfDay: 0 });

    expect(zonedParts(instant).day).toBe(1);
    expect(zonedParts(instant).minutesOfDay).toBe(0);
  });
});

describe('nextOccurrence', () => {
  it('находит ближайшую субботу в 18:00 по Еревану', () => {
    /** Четверг, 10 сентября 2026, 12:00 по Еревану. */
    const from = utc('2026-09-10T08:00:00.000Z');
    const next = nextOccurrence(6, '18:00', from);

    expect(next.toISOString()).toBe('2026-09-12T14:00:00.000Z');
  });

  it('считает занятие через пять минут следующим, а не прошедшим', () => {
    /** Суббота, 17:55 по Ереванy. */
    const from = utc('2026-09-12T13:55:00.000Z');
    const next = nextOccurrence(6, '18:00', from);

    expect(next.toISOString()).toBe('2026-09-12T14:00:00.000Z');
  });

  it('переносит на следующую неделю, если время сегодня уже прошло', () => {
    /** Суббота, 19:00 по Ереванy: занятие в 18:00 будет через неделю. */
    const from = utc('2026-09-12T15:00:00.000Z');
    const next = nextOccurrence(6, '18:00', from);

    expect(next.toISOString()).toBe('2026-09-19T14:00:00.000Z');
  });

  it('нормализует номер дня недели', () => {
    const from = utc('2026-09-10T08:00:00.000Z');

    expect(nextOccurrence(0, '10:00', from).toISOString()).toBe(
      nextOccurrence(7, '10:00', from).toISOString(),
    );
  });

  it('уважает переданный часовой пояс', () => {
    const from = utc('2026-09-10T08:00:00.000Z');
    const yerevan = nextOccurrence(6, '18:00', from, site.timeZone);
    const utcZone = nextOccurrence(6, '18:00', from, 'UTC');

    expect(utcZone.getTime() - yerevan.getTime()).toBe(4 * 60 * 60 * 1000);
  });
});

describe('isoDateFallsOnWeekday', () => {
  it('сопоставляет календарную дату с днём недели в поясе бизнеса', () => {
    expect(isoDateFallsOnWeekday('2026-09-12', 6)).toBe(true);
    expect(isoDateFallsOnWeekday('2026-09-12', 5)).toBe(false);
  });

  it('отвергает битую дату вместо совпадения по случайности', () => {
    expect(isoDateFallsOnWeekday('нет-даты', 6)).toBe(false);
  });
});

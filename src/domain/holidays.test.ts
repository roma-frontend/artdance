import { describe, expect, it } from 'vitest';

import en from '@/i18n/messages/en';
import hy from '@/i18n/messages/hy';
import ru from '@/i18n/messages/ru';

import {
  addWorkingDays,
  armenianPublicHolidays,
  armenianPublicHolidaysDetailed,
  isPublicHoliday,
  isWeekend,
  isWorkingDay,
  publicHolidayNameKey,
  publicHolidaysBetween,
  startOfZonedDay,
} from './holidays';

/**
 * Моменты задаются в UTC: тест не должен зависеть от пояса машины. Ереван —
 * UTC+4 круглый год, поэтому полночь 1 января в Ереване — это 31 декабря 20:00 UTC.
 */
const utc = (iso: string): Date => new Date(iso);

describe('armenianPublicHolidays', () => {
  it('объявляет ровно 13 нерабочих дней', () => {
    expect(armenianPublicHolidays(2026)).toHaveLength(13);
  });

  it('каждая дата — полночь в поясе бизнеса, а не в UTC', () => {
    const [first] = armenianPublicHolidaysDetailed(2026);

    /** Полночь 1 января в Ереване = 31 декабря 20:00 UTC. */
    expect(first?.date.toISOString()).toBe('2025-12-31T20:00:00.000Z');
    expect(first?.nameKey).toBe('newYear');
  });

  it('даты идут в календарном порядке', () => {
    const dates = armenianPublicHolidays(2026).map((date) => date.getTime());

    expect([...dates].sort((a, b) => a - b)).toEqual(dates);
  });

  it('список одинаков из года в год: подвижных нерабочих праздников в РА нет', () => {
    const keys = (year: number) =>
      armenianPublicHolidaysDetailed(year).map((holiday) => holiday.nameKey);

    expect(keys(2026)).toEqual(keys(2027));
  });

  it('у каждого праздника есть название во всех трёх локалях', () => {
    /*
     * `nameKey` — обещание, что строка найдётся в namespace `holidays`. Без этой
     * проверки добавленный праздник даёт не ошибку сборки, а имя ключа на экране
     * в той локали, где перевод забыли.
     */
    for (const { nameKey } of armenianPublicHolidaysDetailed(2026)) {
      expect(en.holidays[nameKey], `en.holidays.${nameKey}`).toBeTruthy();
      expect(ru.holidays[nameKey], `ru.holidays.${nameKey}`).toBeTruthy();
      expect(hy.holidays[nameKey], `hy.holidays.${nameKey}`).toBeTruthy();
    }
  });
});

describe('isPublicHoliday', () => {
  it('день памяти жертв геноцида — нерабочий', () => {
    /** 24 апреля 2026, полдень по Еревану. */
    expect(isPublicHoliday(utc('2026-04-24T08:00:00Z'))).toBe(true);
  });

  it('31 декабря — нерабочий, 30 декабря — рабочий', () => {
    expect(isPublicHoliday(utc('2026-12-31T08:00:00Z'))).toBe(true);
    expect(isPublicHoliday(utc('2026-12-30T08:00:00Z'))).toBe(false);
  });

  it('пояс бизнеса, а не UTC: 31 декабря 21:00 UTC — это уже 1 января в Ереване', () => {
    expect(publicHolidayNameKey(utc('2026-12-31T21:00:00Z'))).toBe('newYear');
  });

  it('обычный день праздником не считается', () => {
    expect(isPublicHoliday(utc('2026-09-12T08:00:00Z'))).toBe(false);
    expect(publicHolidayNameKey(utc('2026-09-12T08:00:00Z'))).toBeNull();
  });
});

describe('isWeekend и isWorkingDay', () => {
  it('12 сентября 2026 — суббота', () => {
    expect(isWeekend(utc('2026-09-12T08:00:00Z'))).toBe(true);
    expect(isWorkingDay(utc('2026-09-12T08:00:00Z'))).toBe(false);
  });

  it('будний день без праздника — рабочий', () => {
    /** 15 сентября 2026 — вторник. */
    expect(isWorkingDay(utc('2026-09-15T08:00:00Z'))).toBe(true);
  });

  it('праздник в будний день рабочим не становится', () => {
    /** 1 мая 2026 — пятница. */
    expect(isWeekend(utc('2026-05-01T08:00:00Z'))).toBe(false);
    expect(isWorkingDay(utc('2026-05-01T08:00:00Z'))).toBe(false);
  });

  it('праздник в выходной не переносится на понедельник: в РА такого правила нет', () => {
    /** 28 марта 2026 — суббота, 8 марта 2026 — воскресенье. */
    expect(isWorkingDay(utc('2026-03-09T08:00:00Z'))).toBe(true);
  });
});

describe('publicHolidaysBetween', () => {
  it('собирает праздники двух лет, когда диапазон перешагивает Новый год', () => {
    const found = publicHolidaysBetween(utc('2026-12-25T08:00:00Z'), utc('2027-01-10T08:00:00Z'));

    expect(found.map((holiday) => holiday.nameKey)).toEqual([
      'newYearEve',
      'newYear',
      'newYearSecond',
      'christmas',
    ]);
  });

  it('включает праздник, который начинается в первый день диапазона', () => {
    const found = publicHolidaysBetween(utc('2026-05-01T15:00:00Z'), utc('2026-05-05T08:00:00Z'));

    expect(found.map((holiday) => holiday.nameKey)).toEqual(['labourDay']);
  });

  it('пустой диапазон без праздников', () => {
    expect(publicHolidaysBetween(utc('2026-09-10T08:00:00Z'), utc('2026-09-15T08:00:00Z'))).toEqual(
      [],
    );
  });
});

describe('startOfZonedDay', () => {
  it('срезает время до полуночи в поясе бизнеса', () => {
    expect(startOfZonedDay(utc('2026-09-12T21:30:00Z')).toISOString()).toBe(
      /** 21:30 UTC — это 01:30 13 сентября в Ереване, значит день — 13-е. */
      '2026-09-12T20:00:00.000Z',
    );
  });
});

describe('addWorkingDays', () => {
  it('перескакивает выходные', () => {
    /** Пятница 11 сентября 2026 + 1 рабочий день = понедельник 14 сентября. */
    const result = addWorkingDays(utc('2026-09-11T08:00:00Z'), 1);

    expect(startOfZonedDay(result).toISOString()).toBe('2026-09-13T20:00:00.000Z');
  });

  it('перескакивает новогодние праздники', () => {
    /*
     * Заказ 30 декабря 2026 (среда) с доставкой «2 рабочих дня». Дальше: 31
     * декабря — нерабочий праздник, 1 января (пятница) — нерабочий, 2 января
     * (суббота) — праздник и выходной, 3 января — воскресенье. Первые два рабочих
     * дня — понедельник 4-е и вторник 5-е, значит срок — 5 января 2027.
     *
     * Полночь 5 января в Ереване — это 4 января 20:00 UTC: сравнение идёт с
     * моментом, а название дня остаётся ереванским.
     */
    const result = addWorkingDays(utc('2026-12-30T08:00:00Z'), 2);

    expect(startOfZonedDay(result).toISOString()).toBe('2027-01-04T20:00:00.000Z');
  });

  it('ноль рабочих дней не сдвигает дату', () => {
    const result = addWorkingDays(utc('2026-09-15T08:00:00Z'), 0);

    expect(startOfZonedDay(result).toISOString()).toBe('2026-09-14T20:00:00.000Z');
  });
});

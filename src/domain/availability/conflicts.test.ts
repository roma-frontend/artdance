/**
 * Тесты проверок конфликтов. Каждая проверка обязана давать не «нельзя», а
 * конкретный код ошибки: от него зависит и сообщение на экране, и HTTP-статус.
 */

import { describe, expect, it } from 'vitest';

import { booking } from '@/config/business';
import { isDomainError, type ErrorCode } from '@/domain/errors';
import type { Interval } from '@/lib/time/interval';

import {
  assertCapacity,
  assertInsideAvailability,
  assertNoConflict,
  assertNoDuplicateEnrollment,
  assertWithinPolicy,
  type BookingPolicy,
} from './conflicts';

const utc = (iso: string): Date => new Date(iso);
const span = (startIso: string, endIso: string): Interval => ({
  start: utc(startIso),
  end: utc(endIso),
});

/** Код ошибки, с которым упала проверка. `null` — не упала. */
function codeOf(action: () => void): ErrorCode | null {
  try {
    action();
    return null;
  } catch (error) {
    if (isDomainError(error)) return error.code;
    throw error;
  }
}

/** Суббота 12 сентября 2026, 18:00–19:00 по Еревану. */
const candidate = span('2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z');

describe('assertNoConflict', () => {
  it('пропускает бронь в свободное время', () => {
    expect(codeOf(() => assertNoConflict([], candidate, 0))).toBeNull();
  });

  it('соприкосновение конфликтом не является', () => {
    const previous = span('2026-09-12T13:00:00Z', '2026-09-12T14:00:00Z');

    expect(codeOf(() => assertNoConflict([previous], candidate, 0))).toBeNull();
  });

  it('наложение даёт SLOT_CONFLICT', () => {
    const other = span('2026-09-12T14:30:00Z', '2026-09-12T15:30:00Z');

    expect(codeOf(() => assertNoConflict([other], candidate, 0))).toBe('SLOT_CONFLICT');
  });

  it('буфер превращает соприкосновение в конфликт', () => {
    const previous = span('2026-09-12T13:00:00Z', '2026-09-12T14:00:00Z');

    expect(
      codeOf(() => assertNoConflict([previous], candidate, booking.bufferBetweenBookingsMinutes)),
    ).toBe('SLOT_CONFLICT');
  });

  it('буфер выдерживает корректный зазор', () => {
    const previous = span('2026-09-12T12:00:00Z', '2026-09-12T13:00:00Z');

    expect(
      codeOf(() => assertNoConflict([previous], candidate, booking.bufferBetweenBookingsMinutes)),
    ).toBeNull();
  });

  it('перевёрнутый интервал не проходит молча', () => {
    expect(() =>
      assertNoConflict([], span('2026-09-12T15:00:00Z', '2026-09-12T14:00:00Z'), 0),
    ).toThrow(/interval/);
  });
});

describe('assertInsideAvailability', () => {
  const window = span('2026-09-12T14:00:00Z', '2026-09-12T18:00:00Z');

  it('бронь внутри окна проходит', () => {
    expect(codeOf(() => assertInsideAvailability([window], candidate))).toBeNull();
  });

  it('бронь, выходящая за окно, даёт SLOT_UNAVAILABLE, а не SLOT_CONFLICT', () => {
    const late = span('2026-09-12T17:30:00Z', '2026-09-12T18:30:00Z');

    expect(codeOf(() => assertInsideAvailability([window], late))).toBe('SLOT_UNAVAILABLE');
  });

  it('без окон доступности не проходит ничего', () => {
    expect(codeOf(() => assertInsideAvailability([], candidate))).toBe('SLOT_UNAVAILABLE');
  });

  it('склеенные соседние окна считаются одним', () => {
    const first = span('2026-09-12T12:00:00Z', '2026-09-12T14:30:00Z');
    const second = span('2026-09-12T14:30:00Z', '2026-09-12T18:00:00Z');

    expect(codeOf(() => assertInsideAvailability([first, second], candidate))).toBeNull();
  });
});

describe('assertCapacity', () => {
  it('пропускает, когда мест хватает', () => {
    expect(codeOf(() => assertCapacity(8, 2, 12))).toBeNull();
  });

  it('заполнение ровно под завязку допустимо', () => {
    expect(codeOf(() => assertCapacity(10, 2, 12))).toBeNull();
  });

  it('перебор даёт CAPACITY_EXCEEDED', () => {
    expect(codeOf(() => assertCapacity(11, 2, 12))).toBe('CAPACITY_EXCEEDED');
  });

  it('сообщает, сколько мест осталось', () => {
    try {
      assertCapacity(11, 2, 12);
      expect.unreachable('проверка обязана бросить');
    } catch (error) {
      if (!isDomainError(error)) throw error;
      expect(error.params).toEqual({ count: 1 });
      expect(error.messageKey).toBe('booking.capacityError');
    }
  });

  it('заявка на ноль человек — ошибка данных, а не бесплатная бронь', () => {
    expect(codeOf(() => assertCapacity(0, 0, 12))).toBe('CAPACITY_EXCEEDED');
  });
});

describe('assertWithinPolicy', () => {
  const policy: BookingPolicy = {
    minLeadMinutes: booking.minLeadTimeMinutes,
    maxAdvanceDays: booking.maxAdvanceDays,
    allowedDurationsMinutes: booking.durationsMinutes,
    granularityMinutes: booking.slotGranularityMinutes,
  };

  /** Пятница 11 сентября 2026, 12:00 по Еревану. */
  const now = utc('2026-09-11T08:00:00Z');

  it('корректная бронь проходит', () => {
    expect(codeOf(() => assertWithinPolicy(candidate, policy, now))).toBeNull();
  });

  it('слишком близкая бронь даёт LEAD_TIME_VIOLATION', () => {
    /** Час до начала при требовании двух. */
    const late = utc('2026-09-12T13:00:00Z');

    expect(codeOf(() => assertWithinPolicy(candidate, policy, late))).toBe('LEAD_TIME_VIOLATION');
  });

  it('сообщение об опережении приходит в часах', () => {
    try {
      assertWithinPolicy(candidate, policy, utc('2026-09-12T13:00:00Z'));
      expect.unreachable('проверка обязана бросить');
    } catch (error) {
      if (!isDomainError(error)) throw error;
      expect(error.params).toEqual({ hours: '2' });
    }
  });

  it('бронь за горизонтом даёт BOOKING_HORIZON_VIOLATION', () => {
    const farAway = span('2027-09-11T14:00:00Z', '2027-09-11T15:00:00Z');

    expect(codeOf(() => assertWithinPolicy(farAway, policy, now))).toBe(
      'BOOKING_HORIZON_VIOLATION',
    );
  });

  it('последний день горизонта открыт до конца суток', () => {
    /*
     * «Открыто на 90 дней» для человека — это дата в календаре, а не 90×24 часа
     * от момента запроса: вечерний слот девяностого дня обязан бронироваться из
     * утреннего запроса.
     */
    const lastDayEvening = span('2026-12-10T17:00:00Z', '2026-12-10T18:00:00Z');

    expect(codeOf(() => assertWithinPolicy(lastDayEvening, policy, now))).toBeNull();
  });

  it('недопустимая длительность отклоняется', () => {
    const odd = span('2026-09-12T14:00:00Z', '2026-09-12T14:50:00Z');

    expect(codeOf(() => assertWithinPolicy(odd, policy, now))).toBe('SLOT_UNAVAILABLE');
  });

  it('начало вне сетки расписания отклоняется', () => {
    const offGrid = span('2026-09-12T14:10:00Z', '2026-09-12T15:10:00Z');

    expect(codeOf(() => assertWithinPolicy(offGrid, policy, now))).toBe('SLOT_UNAVAILABLE');
  });

  it('без ограничения длительностей любая длительность на сетке проходит', () => {
    const long = span('2026-09-12T14:00:00Z', '2026-09-12T19:00:00Z');

    expect(
      codeOf(() =>
        assertWithinPolicy(long, { minLeadMinutes: 0, maxAdvanceDays: 365 }, now),
      ),
    ).toBeNull();
  });
});

describe('assertNoDuplicateEnrollment', () => {
  it('своя бронь в другое время не мешает', () => {
    const own = span('2026-09-12T16:00:00Z', '2026-09-12T17:00:00Z');

    expect(codeOf(() => assertNoDuplicateEnrollment([own], candidate))).toBeNull();
  });

  it('пересечение со своей бронью даёт DUPLICATE_ENROLLMENT, а не SLOT_CONFLICT', () => {
    const own = span('2026-09-12T14:30:00Z', '2026-09-12T15:30:00Z');

    expect(codeOf(() => assertNoDuplicateEnrollment([own], candidate))).toBe(
      'DUPLICATE_ENROLLMENT',
    );
  });

  it('буфер к своим броням не применяется: человек не переодевается между занятиями', () => {
    const own = span('2026-09-12T13:00:00Z', '2026-09-12T14:00:00Z');

    expect(codeOf(() => assertNoDuplicateEnrollment([own], candidate))).toBeNull();
  });
});

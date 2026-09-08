/**
 * Тесты движка доступности. Обязательны по конвенциям: это правила
 * бронирования, и ошибка здесь стоит двойной брони или потерянной выручки.
 *
 * Все моменты задаются в UTC явно, а ожидания читаются в ереванском времени
 * (UTC+4 круглый год): смешивать два пояса в одном тесте — верный способ
 * получить зелёный тест на неверном поведении.
 */

import { describe, expect, it } from 'vitest';

import { armenianPublicHolidays } from '@/domain/holidays';
import type { Interval } from '@/lib/time/interval';

import {
  computeFreeSlots,
  expandRules,
  groupSlotsByDay,
  nextAvailableSlots,
  zonedDateKey,
  type AvailabilityException,
  type AvailabilityInput,
  type AvailabilityRule,
} from './compute';

const utc = (iso: string): Date => new Date(iso);
const range = (startIso: string, endIso: string): Interval => ({
  start: utc(startIso),
  end: utc(endIso),
});

/** Слоты в читаемом виде: «YYYY-MM-DD HH:mm» по Еревану. */
const yerevan = (instant: Date): string =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Yerevan',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);

const starts = (slots: readonly Interval[]): string[] => slots.map((slot) => yerevan(slot.start));

/**
 * Суббота, 12 сентября 2026. Правило «сб, 18:00–22:00» по Еревану, то есть
 * 14:00–18:00 UTC.
 */
const saturdayEvening: AvailabilityRule = { weekday: 6, startTime: '18:00', endTime: '22:00' };

/** База входа: правила и диапазон подставляются в каждом тесте. */
function input(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    rules: [saturdayEvening],
    exceptions: [],
    busy: [],
    holidays: [],
    range: range('2026-09-12T00:00:00Z', '2026-09-13T00:00:00Z'),
    durationMinutes: 60,
    granularityMinutes: 30,
    bufferMinutes: 0,
    minLeadMinutes: 0,
    maxAdvanceDays: 90,
    /** Понедельник 7 сентября 2026, 12:00 по Еревану: до субботы далеко. */
    now: utc('2026-09-07T08:00:00Z'),
    ...overrides,
  };
}

describe('expandRules', () => {
  it('разворачивает правило в окно нужного дня в поясе бизнеса', () => {
    const windows = expandRules(
      [saturdayEvening],
      [],
      range('2026-09-12T00:00:00Z', '2026-09-13T00:00:00Z'),
    );

    expect(windows).toHaveLength(1);
    expect(yerevan(windows[0]!.start)).toBe('2026-09-12 18:00');
    expect(yerevan(windows[0]!.end)).toBe('2026-09-12 22:00');
  });

  it('повторяет правило на каждой неделе диапазона', () => {
    const windows = expandRules(
      [saturdayEvening],
      [],
      range('2026-09-07T00:00:00Z', '2026-09-28T00:00:00Z'),
    );

    expect(windows.map((window) => yerevan(window.start))).toEqual([
      '2026-09-12 18:00',
      '2026-09-19 18:00',
      '2026-09-26 18:00',
    ]);
  });

  it('игнорирует выключенное правило', () => {
    const windows = expandRules(
      [{ ...saturdayEvening, isActive: false }],
      [],
      range('2026-09-12T00:00:00Z', '2026-09-13T00:00:00Z'),
    );

    expect(windows).toEqual([]);
  });

  it('уважает границы действия правила', () => {
    const windows = expandRules(
      [{ ...saturdayEvening, validFrom: utc('2026-09-20T00:00:00Z') }],
      [],
      range('2026-09-07T00:00:00Z', '2026-09-28T00:00:00Z'),
    );

    expect(windows.map((window) => yerevan(window.start))).toEqual([
      '2026-09-26 18:00',
    ]);
  });

  it('склеивает соседние правила одного дня в одно окно', () => {
    const windows = expandRules(
      [
        { weekday: 6, startTime: '10:00', endTime: '14:00' },
        { weekday: 6, startTime: '14:00', endTime: '18:00' },
      ],
      [],
      range('2026-09-12T00:00:00Z', '2026-09-13T00:00:00Z'),
    );

    expect(windows).toHaveLength(1);
    expect(yerevan(windows[0]!.end)).toBe('2026-09-12 18:00');
  });

  it('переносит окно через полночь, когда конец не позже начала', () => {
    const windows = expandRules(
      [{ weekday: 6, startTime: '22:00', endTime: '01:00' }],
      [],
      range('2026-09-12T00:00:00Z', '2026-09-14T00:00:00Z'),
    );

    expect(yerevan(windows[0]!.start)).toBe('2026-09-12 22:00');
    expect(yerevan(windows[0]!.end)).toBe('2026-09-13 01:00');
  });

  it('блокирующее исключение вырезает часть окна', () => {
    const vacation: AvailabilityException = {
      start: utc('2026-09-12T15:00:00Z'),
      end: utc('2026-09-12T16:00:00Z'),
      isAvailable: false,
    };

    const windows = expandRules(
      [saturdayEvening],
      [vacation],
      range('2026-09-12T00:00:00Z', '2026-09-13T00:00:00Z'),
    );

    expect(windows.map((window) => `${yerevan(window.start)}→${yerevan(window.end)}`)).toEqual([
      '2026-09-12 18:00→2026-09-12 19:00',
      '2026-09-12 20:00→2026-09-12 22:00',
    ]);
  });

  it('открывающее исключение добавляет окно вне правил', () => {
    const extraSunday: AvailabilityException = {
      /** Воскресенье 13 сентября, 12:00–14:00 по Еревану. */
      start: utc('2026-09-13T08:00:00Z'),
      end: utc('2026-09-13T10:00:00Z'),
      isAvailable: true,
    };

    const windows = expandRules(
      [saturdayEvening],
      [extraSunday],
      range('2026-09-13T00:00:00Z', '2026-09-14T00:00:00Z'),
    );

    expect(windows.map((window) => yerevan(window.start))).toEqual(['2026-09-13 12:00']);
  });

  it('блокировка сильнее открытия', () => {
    const openThenBlocked: AvailabilityException[] = [
      { start: utc('2026-09-13T08:00:00Z'), end: utc('2026-09-13T10:00:00Z'), isAvailable: true },
      { start: utc('2026-09-13T08:00:00Z'), end: utc('2026-09-13T10:00:00Z'), isAvailable: false },
    ];

    const windows = expandRules(
      [],
      openThenBlocked,
      range('2026-09-13T00:00:00Z', '2026-09-14T00:00:00Z'),
    );

    expect(windows).toEqual([]);
  });

  it('праздник вырезает регулярное окно', () => {
    /** 1 января 2027 — пятница и нерабочий день. */
    const windows = expandRules(
      [{ weekday: 5, startTime: '18:00', endTime: '22:00' }],
      [],
      range('2026-12-28T00:00:00Z', '2027-01-09T00:00:00Z'),
      'Asia/Yerevan',
      armenianPublicHolidays(2027),
    );

    expect(windows.map((window) => yerevan(window.start))).toEqual(['2027-01-08 18:00']);
  });

  it('открытие сильнее праздника: инструктор объявил окно и работает', () => {
    const worksOnNewYear: AvailabilityException = {
      /** 1 января 2027, 18:00–20:00 по Еревану. */
      start: utc('2027-01-01T14:00:00Z'),
      end: utc('2027-01-01T16:00:00Z'),
      isAvailable: true,
    };

    const windows = expandRules(
      [{ weekday: 5, startTime: '18:00', endTime: '22:00' }],
      [worksOnNewYear],
      range('2026-12-30T00:00:00Z', '2027-01-02T00:00:00Z'),
      'Asia/Yerevan',
      armenianPublicHolidays(2027),
    );

    expect(windows.map((window) => `${yerevan(window.start)}→${yerevan(window.end)}`)).toEqual([
      '2027-01-01 18:00→2027-01-01 20:00',
    ]);
  });

  it('обрезает окно по границам запрошенного диапазона', () => {
    const windows = expandRules(
      [saturdayEvening],
      [],
      /** Диапазон начинается в 20:00 по Еревану, окно — с 18:00. */
      range('2026-09-12T16:00:00Z', '2026-09-13T00:00:00Z'),
    );

    expect(yerevan(windows[0]!.start)).toBe('2026-09-12 20:00');
  });
});

describe('computeFreeSlots — сетка', () => {
  it('нарезает окно на слоты по сетке', () => {
    const slots = computeFreeSlots(input());

    expect(starts(slots)).toEqual([
      '2026-09-12 18:00',
      '2026-09-12 18:30',
      '2026-09-12 19:00',
      '2026-09-12 19:30',
      '2026-09-12 20:00',
      '2026-09-12 20:30',
      '2026-09-12 21:00',
    ]);
  });

  it('слот, не влезающий в окно целиком, не предлагается', () => {
    /** Занятие 120 минут в окне 18:00–22:00: последний старт — 20:00. */
    const slots = computeFreeSlots(input({ durationMinutes: 120 }));

    expect(starts(slots).at(-1)).toBe('2026-09-12 20:00');
  });

  it('сетка отсчитывается от полуночи, а не от начала окна', () => {
    /*
     * Окно начинается в 18:20 — «на глаз» слоты пошли бы с 18:20 и уехали бы на
     * 18:50, 19:20. Сетка от полуночи даёт 18:30, 19:00, 19:30: слоты соседних
     * инструкторов выстраиваются в один столбик, а не в лестницу.
     */
    const slots = computeFreeSlots(
      input({ rules: [{ weekday: 6, startTime: '18:20', endTime: '21:00' }] }),
    );

    expect(starts(slots)).toEqual([
      '2026-09-12 18:30',
      '2026-09-12 19:00',
      '2026-09-12 19:30',
      '2026-09-12 20:00',
    ]);
  });

  it('шаг сетки берётся из аргумента', () => {
    const slots = computeFreeSlots(
      input({
        granularityMinutes: 15,
        rules: [{ weekday: 6, startTime: '18:00', endTime: '19:30' }],
      }),
    );

    expect(starts(slots)).toEqual([
      '2026-09-12 18:00',
      '2026-09-12 18:15',
      '2026-09-12 18:30',
    ]);
  });

  it('без правил и исключений слотов нет', () => {
    expect(computeFreeSlots(input({ rules: [] }))).toEqual([]);
  });

  it('нулевая длительность не даёт слотов вместо бесконечного цикла', () => {
    expect(computeFreeSlots(input({ durationMinutes: 0 }))).toEqual([]);
  });
});

describe('computeFreeSlots — занятое время и буфер', () => {
  it('бронь вырезает пересекающиеся слоты', () => {
    const slots = computeFreeSlots(
      input({
        /** Бронь 19:00–20:00 по Еревану. */
        busy: [range('2026-09-12T15:00:00Z', '2026-09-12T16:00:00Z')],
      }),
    );

    expect(starts(slots)).toEqual([
      '2026-09-12 18:00',
      '2026-09-12 20:00',
      '2026-09-12 20:30',
      '2026-09-12 21:00',
    ]);
  });

  it('буфер отодвигает соседние слоты от брони', () => {
    const slots = computeFreeSlots(
      input({
        busy: [range('2026-09-12T15:00:00Z', '2026-09-12T16:00:00Z')],
        bufferMinutes: 15,
      }),
    );

    /*
     * С буфером 15 минут слот 18:00–19:00 упирается в 19:00 минус буфер, а слот
     * 20:00 начинается ровно на границе буфера — оба выпадают. Остаются 20:30 и
     * 21:00.
     */
    expect(starts(slots)).toEqual(['2026-09-12 20:30', '2026-09-12 21:00']);
  });

  it('удержание слота занимает его так же, как бронь', () => {
    const hold = range('2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z');
    const slots = computeFreeSlots(input({ busy: [hold] }));

    expect(starts(slots)).not.toContain('2026-09-12 18:00');
  });

  it('соприкасающиеся брони не создают слота нулевой длины между собой', () => {
    const slots = computeFreeSlots(
      input({
        busy: [
          range('2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z'),
          range('2026-09-12T15:00:00Z', '2026-09-12T16:00:00Z'),
        ],
      }),
    );

    expect(starts(slots)).toEqual([
      '2026-09-12 20:00',
      '2026-09-12 20:30',
      '2026-09-12 21:00',
    ]);
  });
});

describe('computeFreeSlots — правила платформы', () => {
  it('отсекает слоты раньше минимального опережения', () => {
    const slots = computeFreeSlots(
      input({
        /** Суббота, 17:00 по Еревану. До 19:00 остаётся два часа. */
        now: utc('2026-09-12T13:00:00Z'),
        minLeadMinutes: 120,
      }),
    );

    expect(starts(slots)[0]).toBe('2026-09-12 19:00');
  });

  it('отсекает слоты за горизонтом бронирования', () => {
    const slots = computeFreeSlots(
      input({
        range: range('2026-09-07T00:00:00Z', '2026-12-31T00:00:00Z'),
        maxAdvanceDays: 14,
      }),
    );

    /** От 7 сентября горизонт 14 дней закрывает только субботу 12-го и 19-е. */
    expect([...new Set(starts(slots).map((value) => value.slice(0, 10)))]).toEqual([
      '2026-09-12',
      '2026-09-19',
    ]);
  });

  it('праздник убирает день целиком', () => {
    const slots = computeFreeSlots(
      input({
        rules: [{ weekday: 5, startTime: '18:00', endTime: '22:00' }],
        range: range('2026-12-28T00:00:00Z', '2027-01-04T00:00:00Z'),
        holidays: armenianPublicHolidays(2027),
        now: utc('2026-12-27T08:00:00Z'),
      }),
    );

    expect(slots).toEqual([]);
  });

  it('прошлое не предлагается даже внутри запрошенного диапазона', () => {
    const slots = computeFreeSlots(
      input({
        /** Суббота, 20:15 по Еревану: первая половина окна уже прошла. */
        now: utc('2026-09-12T16:15:00Z'),
      }),
    );

    expect(starts(slots)).toEqual(['2026-09-12 20:30', '2026-09-12 21:00']);
  });

  it('пустой диапазон после пересечения с горизонтом не падает', () => {
    expect(
      computeFreeSlots(
        input({ range: range('2026-09-12T00:00:00Z', '2026-09-13T00:00:00Z'), maxAdvanceDays: 0 }),
      ),
    ).toEqual([]);
  });
});

describe('nextAvailableSlots', () => {
  it('возвращает запрошенное число ближайших слотов', () => {
    const slots = nextAvailableSlots(
      input({ range: range('2026-09-07T00:00:00Z', '2026-10-31T00:00:00Z') }),
      3,
    );

    expect(starts(slots)).toEqual([
      '2026-09-12 18:00',
      '2026-09-12 18:30',
      '2026-09-12 19:00',
    ]);
  });

  it('нулевое или отрицательное количество даёт пустой список', () => {
    expect(nextAvailableSlots(input(), 0)).toEqual([]);
    expect(nextAvailableSlots(input(), -1)).toEqual([]);
  });

  it('не выдумывает слоты, когда доступности нет', () => {
    expect(nextAvailableSlots(input({ rules: [] }), 3)).toEqual([]);
  });
});

describe('zonedDateKey и groupSlotsByDay', () => {
  it('ключ даты считается в поясе бизнеса', () => {
    /** 21:30 UTC 12 сентября — это 01:30 13 сентября в Ереване. */
    expect(zonedDateKey(utc('2026-09-12T21:30:00Z'))).toBe('2026-09-13');
  });

  it('группирует слоты по ереванским суткам в календарном порядке', () => {
    const slots = computeFreeSlots(
      input({ range: range('2026-09-07T00:00:00Z', '2026-09-28T00:00:00Z') }),
    );
    const days = groupSlotsByDay(slots);

    expect(days.map((day) => day.dateKey)).toEqual([
      '2026-09-12',
      '2026-09-19',
      '2026-09-26',
    ]);
    expect(days[0]?.slots).toHaveLength(7);
  });

  it('ночной слот попадает в свои ереванские сутки, а не в предыдущие', () => {
    const days = groupSlotsByDay(
      computeFreeSlots(
        input({
          rules: [{ weekday: 6, startTime: '22:00', endTime: '02:00' }],
          range: range('2026-09-12T00:00:00Z', '2026-09-14T00:00:00Z'),
        }),
      ),
    );

    expect(days.map((day) => day.dateKey)).toEqual(['2026-09-12', '2026-09-13']);
  });
});

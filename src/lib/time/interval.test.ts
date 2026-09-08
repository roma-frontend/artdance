import { describe, expect, it } from 'vitest';

import {
  contains,
  containsInstant,
  durationMinutes,
  intersectIntervals,
  IntervalError,
  isValidInterval,
  mergeIntervals,
  overlaps,
  padInterval,
  sortIntervals,
  subtractFromAll,
  subtractIntervals,
  totalMinutes,
  type Interval,
} from './interval';

/**
 * Моменты задаются в UTC явно: тест не должен зависеть от часового пояса машины.
 * Часовые поясов на уровне интервалов не существует — это уровень моментов.
 */
const at = (iso: string): Date => new Date(iso);
const interval = (startIso: string, endIso: string): Interval => ({
  start: at(startIso),
  end: at(endIso),
});

/** Читаемая форма отрезка для сравнений: «начало→конец» в ISO. */
const shape = (list: readonly Interval[]): string[] =>
  list.map((item) => `${item.start.toISOString()}→${item.end.toISOString()}`);

describe('isValidInterval', () => {
  it('принимает отрезок положительной длительности', () => {
    expect(isValidInterval(interval('2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z'))).toBe(true);
  });

  it('отвергает нулевую длительность: потерянная длительность выше по стеку', () => {
    expect(isValidInterval(interval('2026-09-12T14:00:00Z', '2026-09-12T14:00:00Z'))).toBe(false);
  });

  it('отвергает перевёрнутый отрезок', () => {
    expect(isValidInterval(interval('2026-09-12T15:00:00Z', '2026-09-12T14:00:00Z'))).toBe(false);
  });

  it('отвергает нераспознанную дату', () => {
    expect(isValidInterval({ start: new Date('нет'), end: at('2026-09-12T15:00:00Z') })).toBe(false);
  });
});

describe('durationMinutes', () => {
  it('считает длительность в минутах', () => {
    expect(durationMinutes(interval('2026-09-12T14:00:00Z', '2026-09-12T15:30:00Z'))).toBe(90);
  });

  it('бросает на некорректном отрезке, а не возвращает отрицательное число', () => {
    expect(() => durationMinutes(interval('2026-09-12T15:00:00Z', '2026-09-12T14:00:00Z'))).toThrow(
      IntervalError,
    );
  });
});

describe('overlaps', () => {
  it('соприкосновение не является пересечением: [start, end)', () => {
    const first = interval('2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z');
    const second = interval('2026-09-12T15:00:00Z', '2026-09-12T16:00:00Z');

    expect(overlaps(first, second)).toBe(false);
  });

  it('находит частичное наложение', () => {
    const first = interval('2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z');
    const second = interval('2026-09-12T14:30:00Z', '2026-09-12T16:00:00Z');

    expect(overlaps(first, second)).toBe(true);
  });

  it('вложенный отрезок пересекается с внешним', () => {
    const outer = interval('2026-09-12T14:00:00Z', '2026-09-12T18:00:00Z');
    const inner = interval('2026-09-12T15:00:00Z', '2026-09-12T16:00:00Z');

    expect(overlaps(outer, inner)).toBe(true);
    expect(overlaps(inner, outer)).toBe(true);
  });

  it('буфер превращает соприкосновение в конфликт', () => {
    const first = interval('2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z');
    const second = interval('2026-09-12T15:00:00Z', '2026-09-12T16:00:00Z');

    expect(overlaps(first, second, 15)).toBe(true);
  });

  it('буфер считается один раз, а не с обеих сторон', () => {
    /*
     * Между отрезками ровно 15 минут. Требование «между бронями 15 минут»
     * выполнено, и конфликта быть не должно. Если буфер раздвинуть с двух сторон,
     * зазор станет 30 минут, и корректное расписание объявит себя занятым.
     */
    const first = interval('2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z');
    const second = interval('2026-09-12T15:15:00Z', '2026-09-12T16:00:00Z');

    expect(overlaps(first, second, 15)).toBe(false);
    expect(overlaps(second, first, 15)).toBe(false);
  });

  it('симметричен при любом буфере', () => {
    const first = interval('2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z');
    const second = interval('2026-09-12T15:10:00Z', '2026-09-12T16:00:00Z');

    expect(overlaps(first, second, 15)).toBe(overlaps(second, first, 15));
  });
});

describe('padInterval', () => {
  it('раздвигает границы наружу', () => {
    const padded = padInterval(interval('2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z'), 30);

    expect(padded.start.toISOString()).toBe('2026-09-12T13:30:00.000Z');
    expect(padded.end.toISOString()).toBe('2026-09-12T15:30:00.000Z');
  });
});

describe('contains и containsInstant', () => {
  const window = interval('2026-09-12T14:00:00Z', '2026-09-12T18:00:00Z');

  it('вложенность по границам включительно', () => {
    expect(contains(window, interval('2026-09-12T14:00:00Z', '2026-09-12T18:00:00Z'))).toBe(true);
    expect(contains(window, interval('2026-09-12T13:59:00Z', '2026-09-12T18:00:00Z'))).toBe(false);
  });

  it('начало входит в отрезок, конец — нет', () => {
    expect(containsInstant(window, at('2026-09-12T14:00:00Z'))).toBe(true);
    expect(containsInstant(window, at('2026-09-12T18:00:00Z'))).toBe(false);
  });
});

describe('intersectIntervals', () => {
  it('возвращает общую часть', () => {
    const common = intersectIntervals(
      interval('2026-09-12T14:00:00Z', '2026-09-12T16:00:00Z'),
      interval('2026-09-12T15:00:00Z', '2026-09-12T18:00:00Z'),
    );

    expect(shape(common ? [common] : [])).toEqual([
      '2026-09-12T15:00:00.000Z→2026-09-12T16:00:00.000Z',
    ]);
  });

  it('соприкосновение общей части не даёт', () => {
    expect(
      intersectIntervals(
        interval('2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z'),
        interval('2026-09-12T15:00:00Z', '2026-09-12T16:00:00Z'),
      ),
    ).toBeNull();
  });
});

describe('sortIntervals', () => {
  it('сортирует по началу, при равных началах — короткий раньше', () => {
    const sorted = sortIntervals([
      interval('2026-09-12T16:00:00Z', '2026-09-12T17:00:00Z'),
      interval('2026-09-12T14:00:00Z', '2026-09-12T18:00:00Z'),
      interval('2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z'),
    ]);

    expect(shape(sorted)).toEqual([
      '2026-09-12T14:00:00.000Z→2026-09-12T15:00:00.000Z',
      '2026-09-12T14:00:00.000Z→2026-09-12T18:00:00.000Z',
      '2026-09-12T16:00:00.000Z→2026-09-12T17:00:00.000Z',
    ]);
  });

  it('не меняет исходный массив', () => {
    const input = [
      interval('2026-09-12T16:00:00Z', '2026-09-12T17:00:00Z'),
      interval('2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z'),
    ];
    sortIntervals(input);

    expect(input[0]?.start.toISOString()).toBe('2026-09-12T16:00:00.000Z');
  });
});

describe('mergeIntervals', () => {
  it('склеивает перекрывающиеся', () => {
    const merged = mergeIntervals([
      interval('2026-09-12T14:00:00Z', '2026-09-12T16:00:00Z'),
      interval('2026-09-12T15:00:00Z', '2026-09-12T17:00:00Z'),
    ]);

    expect(shape(merged)).toEqual(['2026-09-12T14:00:00.000Z→2026-09-12T17:00:00.000Z']);
  });

  it('склеивает соприкасающиеся: между ними нет свободного времени', () => {
    const merged = mergeIntervals([
      interval('2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z'),
      interval('2026-09-12T15:00:00Z', '2026-09-12T16:00:00Z'),
    ]);

    expect(shape(merged)).toEqual(['2026-09-12T14:00:00.000Z→2026-09-12T16:00:00.000Z']);
  });

  it('оставляет раздельными отрезки с разрывом', () => {
    const merged = mergeIntervals([
      interval('2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z'),
      interval('2026-09-12T16:00:00Z', '2026-09-12T17:00:00Z'),
    ]);

    expect(merged).toHaveLength(2);
  });

  it('поглощает вложенный отрезок', () => {
    const merged = mergeIntervals([
      interval('2026-09-12T14:00:00Z', '2026-09-12T20:00:00Z'),
      interval('2026-09-12T15:00:00Z', '2026-09-12T16:00:00Z'),
    ]);

    expect(shape(merged)).toEqual(['2026-09-12T14:00:00.000Z→2026-09-12T20:00:00.000Z']);
  });

  it('отбрасывает некорректные отрезки вместо падения', () => {
    const merged = mergeIntervals([
      interval('2026-09-12T14:00:00Z', '2026-09-12T14:00:00Z'),
      interval('2026-09-12T16:00:00Z', '2026-09-12T17:00:00Z'),
    ]);

    expect(merged).toHaveLength(1);
  });

  it('не мутирует входные отрезки', () => {
    const first = interval('2026-09-12T14:00:00Z', '2026-09-12T16:00:00Z');
    mergeIntervals([first, interval('2026-09-12T15:00:00Z', '2026-09-12T18:00:00Z')]);

    expect(first.end.toISOString()).toBe('2026-09-12T16:00:00.000Z');
  });
});

describe('subtractIntervals', () => {
  const workday = interval('2026-09-12T14:00:00Z', '2026-09-12T20:00:00Z');

  it('вырезает блокировку в середине', () => {
    const free = subtractIntervals(workday, [
      interval('2026-09-12T16:00:00Z', '2026-09-12T17:00:00Z'),
    ]);

    expect(shape(free)).toEqual([
      '2026-09-12T14:00:00.000Z→2026-09-12T16:00:00.000Z',
      '2026-09-12T17:00:00.000Z→2026-09-12T20:00:00.000Z',
    ]);
  });

  it('срезает начало окна', () => {
    const free = subtractIntervals(workday, [
      interval('2026-09-12T13:00:00Z', '2026-09-12T15:00:00Z'),
    ]);

    expect(shape(free)).toEqual(['2026-09-12T15:00:00.000Z→2026-09-12T20:00:00.000Z']);
  });

  it('полное перекрытие не оставляет свободного времени', () => {
    const free = subtractIntervals(workday, [
      interval('2026-09-12T10:00:00Z', '2026-09-12T22:00:00Z'),
    ]);

    expect(free).toEqual([]);
  });

  it('блокировка вне окна ничего не меняет', () => {
    const free = subtractIntervals(workday, [
      interval('2026-09-12T21:00:00Z', '2026-09-12T22:00:00Z'),
      interval('2026-09-12T10:00:00Z', '2026-09-12T11:00:00Z'),
    ]);

    expect(shape(free)).toEqual(['2026-09-12T14:00:00.000Z→2026-09-12T20:00:00.000Z']);
  });

  it('не создаёт промежутков нулевой длины между соприкасающимися блокировками', () => {
    const free = subtractIntervals(workday, [
      interval('2026-09-12T15:00:00Z', '2026-09-12T16:00:00Z'),
      interval('2026-09-12T16:00:00Z', '2026-09-12T17:00:00Z'),
    ]);

    expect(shape(free)).toEqual([
      '2026-09-12T14:00:00.000Z→2026-09-12T15:00:00.000Z',
      '2026-09-12T17:00:00.000Z→2026-09-12T20:00:00.000Z',
    ]);
  });

  it('порядок блокировок не влияет на результат', () => {
    const blocks = [
      interval('2026-09-12T18:00:00Z', '2026-09-12T19:00:00Z'),
      interval('2026-09-12T15:00:00Z', '2026-09-12T16:00:00Z'),
    ];

    expect(shape(subtractIntervals(workday, blocks))).toEqual(
      shape(subtractIntervals(workday, [...blocks].reverse())),
    );
  });

  it('без блокировок возвращает окно целиком', () => {
    expect(shape(subtractIntervals(workday, []))).toEqual([
      '2026-09-12T14:00:00.000Z→2026-09-12T20:00:00.000Z',
    ]);
  });
});

describe('subtractFromAll', () => {
  it('режет каждое окно расписания', () => {
    const free = subtractFromAll(
      [
        interval('2026-09-12T14:00:00Z', '2026-09-12T18:00:00Z'),
        interval('2026-09-13T14:00:00Z', '2026-09-13T18:00:00Z'),
      ],
      [
        interval('2026-09-12T15:00:00Z', '2026-09-12T16:00:00Z'),
        interval('2026-09-13T17:00:00Z', '2026-09-13T18:00:00Z'),
      ],
    );

    expect(shape(free)).toEqual([
      '2026-09-12T14:00:00.000Z→2026-09-12T15:00:00.000Z',
      '2026-09-12T16:00:00.000Z→2026-09-12T18:00:00.000Z',
      '2026-09-13T14:00:00.000Z→2026-09-13T17:00:00.000Z',
    ]);
  });
});

describe('totalMinutes', () => {
  it('не считает перекрытие дважды', () => {
    const total = totalMinutes([
      interval('2026-09-12T14:00:00Z', '2026-09-12T16:00:00Z'),
      interval('2026-09-12T15:00:00Z', '2026-09-12T17:00:00Z'),
    ]);

    expect(total).toBe(180);
  });
});

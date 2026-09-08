/**
 * ДОСТУПНОСТЬ — превращение правил расписания в конкретные свободные слоты.
 *
 * Это ядро самой дорогой части системы (задача 3.1 плана). Всё, что здесь
 * происходит, — чистые функции над данными: ни запроса к базе, ни `new Date()`
 * без аргумента, ни чтения конфигурации по месту. Поэтому модуль тестируется
 * целиком, а тесты для правил бронирования обязательны по конвенциям проекта.
 *
 * Вход собирает вызывающая сторона (запрос к БД или фикстуры), правила
 * приходят числами из `config/business.ts`. «Откройте бронирование на полгода» и
 * «сделайте сетку по 15 минут» — правка конфигурации, а не этого файла.
 *
 * ## Пять слоёв, из которых складывается ответ
 *
 * 1. **Регулярное расписание** (`AvailabilityRule`): «вт и чт, 18:00–22:00».
 *    Разворачивается в конкретные окна на каждый календарный день диапазона.
 * 2. **Праздники**: вырезаются из регулярного расписания. Нерабочий день не
 *    предлагается, даже если по правилу это рабочий вторник.
 * 3. **Исключения-открытия** (`isAvailable: true`): «в это воскресенье работаю».
 *    Добавляются поверх и **сильнее праздника**: если инструктор объявил окно
 *    1 января, значит он работает 1 января, и спорить с ним календарём незачем.
 * 4. **Исключения-блокировки** (`isAvailable: false`): отпуск, разовая отмена.
 *    Вырезаются последними — блокировка сильнее любого открытия.
 * 5. **Занятое время** (`busy`): брони, удержания `SlotHold`, аренда зала.
 *    Вырезается с буфером `bufferBetweenBookingsMinutes` с обеих сторон.
 *
 * ## Почему слот считается сервером, а не браузером
 *
 * Часы устройства могут быть неверны, часовой пояс посетителя — любой, а «сетка
 * по 30 минут от 18:00 в Ереване» зависит и от того, и от другого. Ответ на
 * вопрос «что свободно» обязан быть один для всех, поэтому `now` всегда приходит
 * параметром: тесты не зависят от даты запуска, а прод — от часов клиента.
 *
 * ## Чего здесь намеренно нет
 *
 * Гонки за слот. Две одновременные попытки занять один слот увидят одинаковую
 * доступность, и решать спор будет уникальный индекс `SlotHold` в БД, а не эти
 * функции. Их задача — не предлагать заведомо занятое; гарантию даёт база.
 *
 * Сигнатуры зафиксированы в `docs/09-helpers-catalog.md` §2.
 */

import { startOfZonedDay } from '@/domain/holidays';
import { site } from '@/config/site';
import { MINUTES_PER_DAY, alignToGranularity, parseClock } from '@/lib/time/clock';
import {
  mergeIntervals,
  padInterval,
  subtractFromAll,
  type Interval,
} from '@/lib/time/interval';
import { fromZonedParts, zonedParts } from '@/lib/time/schedule';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = MINUTES_PER_DAY * MS_PER_MINUTE;

/**
 * Регулярное правило расписания. Повторяет `AvailabilityRule` в схеме Prisma:
 * ресурс (инструктор или зал) известен вызывающей стороне, здесь он не нужен —
 * функция считает доступность одного ресурса за раз.
 */
export interface AvailabilityRule {
  /** 0 — воскресенье, как в `Date.getDay()` и в схеме. */
  weekday: number;
  /** Время суток `HH:mm` в поясе бизнеса. */
  startTime: string;
  endTime: string;
  /** Границы действия правила. `null` — бессрочно. */
  validFrom?: Date | null;
  validUntil?: Date | null;
  isActive?: boolean;
}

/**
 * Разовое отклонение от расписания.
 *
 * `isAvailable: true` — окно вопреки правилам, `false` — блокировка.
 * Совпадает с `AvailabilityException` в схеме; поля `startsAt`/`endsAt`
 * приводятся к `start`/`end` на границе с базой, чтобы весь домен говорил об
 * интервалах одним словарём.
 */
export interface AvailabilityException extends Interval {
  isAvailable: boolean;
}

export interface AvailabilityInput {
  rules: readonly AvailabilityRule[];
  exceptions: readonly AvailabilityException[];
  /** Брони, удержания и аренда — всё, что занимает ресурс. */
  busy: readonly Interval[];
  /** Нерабочие дни (полночь в поясе бизнеса). Пустой массив = работаем всегда. */
  holidays: readonly Date[];
  /** Отрезок календаря, за который спрашивают доступность. */
  range: Interval;
  durationMinutes: number;
  granularityMinutes: number;
  /** Буфер между занятиями одного ресурса. */
  bufferMinutes: number;
  /** Минимум «за сколько» можно бронировать. */
  minLeadMinutes: number;
  /** Горизонт бронирования вперёд в днях. */
  maxAdvanceDays: number;
  /** Всегда параметром: тесты не зависят от даты запуска. */
  now: Date;
  timeZone?: string;
}

/** Активно ли правило на конкретный календарный день. */
function ruleAppliesOnDay(rule: AvailabilityRule, dayStart: Date, dayEnd: Date): boolean {
  if (rule.isActive === false) return false;
  if (rule.validFrom && rule.validFrom.getTime() >= dayEnd.getTime()) return false;
  if (rule.validUntil && rule.validUntil.getTime() <= dayStart.getTime()) return false;
  return true;
}

/**
 * Календарные дни, попадающие в диапазон, — полночь каждого в поясе бизнеса.
 *
 * Шаг делается через полтора суток с последующим срезом до полуночи, а не
 * прибавлением ровно 24 часов: при смене смещения пояса (в Армении её нет, но
 * функция не должна этого знать) сложение суток съезжает на час и однажды
 * пропускает или дублирует день.
 */
function zonedDaysIn(range: Interval, timeZone: string): Date[] {
  const days: Date[] = [];
  let cursor = startOfZonedDay(range.start, timeZone);
  const last = range.end.getTime();

  while (cursor.getTime() < last) {
    days.push(cursor);
    cursor = startOfZonedDay(new Date(cursor.getTime() + MS_PER_DAY + MS_PER_DAY / 2), timeZone);
  }

  return days;
}

/** Окно одного дня по правилу: `HH:mm`–`HH:mm` в поясе бизнеса. */
function ruleWindowOnDay(rule: AvailabilityRule, dayStart: Date, timeZone: string): Interval | null {
  const from = parseClock(rule.startTime);
  const rawTo = parseClock(rule.endTime);
  /*
   * Конец не позже начала означает переход через полночь: «22:00–01:00» — это
   * рабочее окно ночного зала, а не ошибка данных. Ноль минут — ошибка: правило
   * без длительности не даёт ни одного слота, и молча его игнорировать значит
   * скрыть опечатку в расписании.
   */
  const to = rawTo > from ? rawTo : rawTo + MINUTES_PER_DAY;
  if (to === from) return null;

  const parts = zonedParts(dayStart, timeZone);
  const start = fromZonedParts(
    { year: parts.year, month: parts.month, day: parts.day, minutesOfDay: from },
    timeZone,
  );

  return { start, end: new Date(start.getTime() + (to - from) * MS_PER_MINUTE) };
}

/** Нерабочие сутки как интервалы, чтобы вычитаться наравне с остальным. */
function holidayIntervals(holidays: readonly Date[], timeZone: string): Interval[] {
  return holidays.map((holiday) => {
    const start = startOfZonedDay(holiday, timeZone);
    return {
      start,
      end: startOfZonedDay(new Date(start.getTime() + MS_PER_DAY + MS_PER_DAY / 2), timeZone),
    };
  });
}

/** Обрезка окон по границам запрошенного диапазона. */
function clipToRange(windows: readonly Interval[], range: Interval): Interval[] {
  const result: Interval[] = [];
  for (const window of windows) {
    const start = Math.max(window.start.getTime(), range.start.getTime());
    const end = Math.min(window.end.getTime(), range.end.getTime());
    if (end > start) result.push({ start: new Date(start), end: new Date(end) });
  }
  return result;
}

/**
 * Правила и исключения → рабочие окна внутри диапазона.
 *
 * Порядок применения зафиксирован в шапке модуля: праздники вырезаются из
 * регулярного расписания, открытия добавляются поверх праздников, блокировки
 * вырезаются последними.
 */
export function expandRules(
  rules: readonly AvailabilityRule[],
  exceptions: readonly AvailabilityException[],
  range: Interval,
  timeZone: string = site.timeZone,
  holidays: readonly Date[] = [],
): Interval[] {
  const regular: Interval[] = [];

  for (const day of zonedDaysIn(range, timeZone)) {
    const dayEnd = new Date(day.getTime() + MS_PER_DAY);
    const weekday = zonedParts(day, timeZone).weekday;

    for (const rule of rules) {
      if (((rule.weekday % 7) + 7) % 7 !== weekday) continue;
      if (!ruleAppliesOnDay(rule, day, dayEnd)) continue;

      const window = ruleWindowOnDay(rule, day, timeZone);
      if (window) regular.push(window);
    }
  }

  const openings = exceptions.filter((exception) => exception.isAvailable);
  const blocks = exceptions.filter((exception) => !exception.isAvailable);

  const workable = subtractFromAll(
    mergeIntervals(regular),
    holidayIntervals(holidays, timeZone),
  );
  const withOpenings = mergeIntervals([...workable, ...openings]);

  return clipToRange(subtractFromAll(withOpenings, blocks), range);
}

/**
 * Свободные слоты фиксированной длительности.
 *
 * Слот попадает в ответ, только если целиком лежит в рабочем окне: занятие на 90
 * минут не предлагается за час до закрытия зала. Начала выравниваются по сетке
 * `granularityMinutes` от полуночи в поясе бизнеса — так «19:30» получается
 * сеткой, а не совпадением, и слоты у соседних инструкторов выстраиваются в один
 * столбик в каталоге.
 */
export function computeFreeSlots(input: AvailabilityInput): Interval[] {
  const timeZone = input.timeZone ?? site.timeZone;
  const {
    durationMinutes: duration,
    granularityMinutes: granularity,
    bufferMinutes,
    minLeadMinutes,
    maxAdvanceDays,
    now,
  } = input;

  if (duration <= 0 || granularity <= 0) return [];

  /*
   * Границы «когда вообще можно»: не раньше, чем через `minLeadMinutes`, и не
   * дальше горизонта. Пересечение с запрошенным диапазоном берётся сразу, чтобы
   * не разворачивать правила на 90 дней, когда спрашивают про один день.
   */
  const earliest = new Date(now.getTime() + minLeadMinutes * MS_PER_MINUTE);
  const horizon = new Date(now.getTime() + maxAdvanceDays * MS_PER_DAY);

  const effective: Interval = {
    start: new Date(Math.max(input.range.start.getTime(), earliest.getTime())),
    end: new Date(Math.min(input.range.end.getTime(), horizon.getTime())),
  };
  if (effective.end.getTime() <= effective.start.getTime()) return [];

  const windows = expandRules(
    input.rules,
    input.exceptions,
    /*
     * Правила разворачиваются на сутки шире с обеих сторон: окно, начавшееся до
     * `effective.start`, всё ещё даёт слоты внутри диапазона, а ночное окно
     * последнего дня уходит за его конец.
     */
    {
      start: new Date(effective.start.getTime() - MS_PER_DAY),
      end: new Date(effective.end.getTime() + MS_PER_DAY),
    },
    timeZone,
    input.holidays,
  );

  const blockedByBusy = input.busy.map((interval) => padInterval(interval, bufferMinutes));
  const free = subtractFromAll(windows, blockedByBusy);

  const slots: Interval[] = [];

  for (const window of free) {
    const anchor = startOfZonedDay(window.start, timeZone).getTime();
    const offsetMinutes = (window.start.getTime() - anchor) / MS_PER_MINUTE;
    const firstOffset = alignToGranularity(offsetMinutes, granularity, 'up');

    for (let offset = firstOffset; ; offset += granularity) {
      const start = anchor + offset * MS_PER_MINUTE;
      const end = start + duration * MS_PER_MINUTE;

      if (end > window.end.getTime()) break;
      if (start < window.start.getTime()) continue;
      if (start < effective.start.getTime()) continue;
      if (start > effective.end.getTime()) break;

      slots.push({ start: new Date(start), end: new Date(end) });
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Ближайшие свободные слоты — фича «мест нет, но есть вот эти три» (C-02).
 *
 * Отдельная функция, а не `.slice()` по месту вызова: пустая выдача — самая
 * частая точка отказа в бронировании, и превращать её в предложение нужно
 * одинаково на карточке занятия, в письме и в листе ожидания.
 */
export function nextAvailableSlots(input: AvailabilityInput, count: number): Interval[] {
  if (count <= 0) return [];
  return computeFreeSlots(input).slice(0, count);
}

/** Дата слота как `YYYY-MM-DD` в поясе бизнеса — ключ группировки по дням. */
export function zonedDateKey(instant: Date, timeZone: string = site.timeZone): string {
  const parts = zonedParts(instant, timeZone);
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-');
}

export interface AvailabilityDay {
  /** `YYYY-MM-DD` в поясе бизнеса. */
  dateKey: string;
  /** Полночь этого дня — то, что понимает календарь. */
  date: Date;
  slots: readonly Interval[];
}

/**
 * Слоты по календарным дням — форма, в которой их ждут календарь и сетка времени.
 *
 * Группировка идёт по суткам ПОЯСА БИЗНЕСА, а не устройства: посетитель из
 * Москвы должен видеть ереванские сутки, иначе слот в 01:00 уезжает у него на
 * предыдущий день, а у инструктора остаётся на своём.
 */
export function groupSlotsByDay(
  slots: readonly Interval[],
  timeZone: string = site.timeZone,
): AvailabilityDay[] {
  const byKey = new Map<string, AvailabilityDay>();

  for (const slot of slots) {
    const dateKey = zonedDateKey(slot.start, timeZone);
    const existing = byKey.get(dateKey);
    if (existing) {
      (existing.slots as Interval[]).push(slot);
      continue;
    }
    byKey.set(dateKey, {
      dateKey,
      date: startOfZonedDay(slot.start, timeZone),
      slots: [slot],
    });
  }

  return [...byKey.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * РАСПИСАНИЕ — ближайшая календарная дата у повторяющегося занятия.
 *
 * Занятие в каталоге описано правилом («суббота, 18:00»), а не датами. Чтобы
 * ответить на вопросы «когда следующее» и «что раньше» (сортировка «starting
 * soonest»), правило нужно превратить в момент времени — и ровно здесь начинается
 * место, где легко потерять час.
 *
 * Две ловушки, которые этот модуль закрывает.
 *
 * **Часовой пояс.** «18:00» в расписании — это 18:00 в Ереване, а не в часовом
 * поясе сервера. На Vercel сервер живёт в UTC, и наивный `new Date(y, m, d, 18)`
 * дал бы 22:00 по Ереванy. Пояс берётся из `site.timeZone`, а не из машины.
 *
 * **Сегодня, но уже прошло.** Если сегодня суббота и на часах 19:00, следующее
 * занятие субботы в 18:00 — через неделю, а не через минус час. Сравнение идёт по
 * времени суток, а не только по дню недели.
 *
 * Перехода на летнее время в Армении нет с 2012 года, поэтому смещение стабильно
 * (UTC+4). Модуль всё равно вычисляет его через `Intl`, а не константой: смещение
 * — свойство страны и года, а не нашего кода, и решение «зашить +4» пришлось бы
 * искать по проекту в день, когда оно изменится.
 */

import { site } from '@/config/site';
import { MINUTES_PER_DAY, parseClock } from './clock';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = MINUTES_PER_DAY * MS_PER_MINUTE;

/**
 * Форматтеры кешируются по поясу.
 *
 * `new Intl.DateTimeFormat` — самый дорогой вызов в этом модуле, а движок
 * доступности спрашивает смещение десятки тысяч раз при развёртке расписания на
 * горизонт бронирования. Один формат на пояс превращает секунды в миллисекунды и
 * ничего не меняет в результате: формат зависит только от пояса.
 */
const zoneFormatters = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = zoneFormatters.get(timeZone);
  if (cached) return cached;

  const created = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  zoneFormatters.set(timeZone, created);
  return created;
}

/**
 * Смещение часового пояса от UTC в минутах для конкретного момента.
 *
 * Считается через `Intl`: формат `sv-SE` даёт `YYYY-MM-DD HH:mm:ss`, который
 * разбирается однозначно на любой платформе. Способ выглядит окольным, но у него
 * нет альтернативы без библиотеки: `Date` не умеет отвечать на вопрос «сколько
 * времени в Ереване» напрямую.
 */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const formatted = zoneFormatter(timeZone).format(instant);

  const asUtc = Date.parse(`${formatted.replace(' ', 'T')}Z`);
  return Math.round((asUtc - instant.getTime()) / MS_PER_MINUTE);
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  /** Минуты от полуночи: `18:30` → 1110. */
  minutesOfDay: number;
  /** День недели: 0 — воскресенье, как в `Date.getDay()`. */
  weekday: number;
}

/** Момент времени → календарные части в указанном поясе (по умолчанию — бизнеса). */
export function zonedParts(instant: Date, timeZone: string = site.timeZone): ZonedParts {
  const shifted = new Date(instant.getTime() + zoneOffsetMinutes(instant, timeZone) * MS_PER_MINUTE);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    minutesOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/**
 * Календарные части в поясе бизнеса → момент времени.
 *
 * Смещение берётся дважды: первый раз приблизительно (по предполагаемому
 * моменту), второй — по уточнённому. Это не перестраховка, а необходимость на
 * границе перехода часов: если бы Армения вернула переход на летнее время, один
 * проход давал бы час ошибки в две ночи в году.
 */
export function fromZonedParts(
  parts: { year: number; month: number; day: number; minutesOfDay: number },
  timeZone: string = site.timeZone,
): Date {
  const naive = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    Math.floor(parts.minutesOfDay / 60),
    parts.minutesOfDay % 60,
  );

  const firstGuess = new Date(naive - zoneOffsetMinutes(new Date(naive), timeZone) * MS_PER_MINUTE);
  const refined = naive - zoneOffsetMinutes(firstGuess, timeZone) * MS_PER_MINUTE;
  return new Date(refined);
}

/**
 * Ближайшее наступление «день недели + время суток», начиная с `from`.
 *
 * Включая сам `from`, если время ещё не прошло: занятие, до которого пять минут,
 * — это следующее занятие, а не прошедшее.
 *
 * @param weekday 0 — воскресенье, как в `Date.getDay()`.
 * @param startTime Время суток `HH:mm` в поясе бизнеса.
 */
export function nextOccurrence(
  weekday: number,
  startTime: string,
  from: Date = new Date(),
  timeZone: string = site.timeZone,
): Date {
  const minutesOfDay = parseClock(startTime);
  const here = zonedParts(from, timeZone);
  const normalizedWeekday = ((weekday % 7) + 7) % 7;

  let daysAhead = (normalizedWeekday - here.weekday + 7) % 7;
  /** Сегодня, но время уже прошло → та же строка расписания на следующей неделе. */
  if (daysAhead === 0 && minutesOfDay <= here.minutesOfDay) daysAhead = 7;

  const target = new Date(
    fromZonedParts({ year: here.year, month: here.month, day: here.day, minutesOfDay }, timeZone)
      .getTime() + daysAhead * MS_PER_DAY,
  );

  return target;
}

/**
 * Совпадает ли день недели у занятия с календарной датой `YYYY-MM-DD`.
 *
 * Нужно фильтру «на дату» в каталоге. Дата разбирается как полночь в поясе
 * бизнеса, а не как UTC: `2026-09-12` в Ереване и в UTC — это разные сутки на
 * четыре часа, и без пояса фильтр «на субботу» показывал бы пятничные занятия
 * тем, кто открыл сайт из Лондона.
 */
export function isoDateFallsOnWeekday(
  isoDate: string,
  weekday: number,
  timeZone: string = site.timeZone,
): boolean {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return false;

  const instant = fromZonedParts({ year, month, day, minutesOfDay: 0 }, timeZone);
  return zonedParts(instant, timeZone).weekday === ((weekday % 7) + 7) % 7;
}

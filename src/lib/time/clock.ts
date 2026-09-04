/**
 * ЧАСЫ РАСПИСАНИЯ — время суток как число минут от полуночи.
 *
 * Почему не `Date`: слот занятия — это «18:00 по Еревану», а не момент времени.
 * Момент появляется только когда к слоту добавляется календарная дата. Пока
 * этого не произошло, `Date` вредит: он тащит за собой часовой пояс машины, и
 * «18:00» на сервере во Франкфурте превращается в «16:00» в браузере в Ереване.
 *
 * Почему не строки: со строками нельзя считать. «Занятие в 18:00 длится 90
 * минут» требует сложения, и `'18:00' + 90` в JavaScript даёт `'18:0090'` —
 * ошибка, которую заметит не тест, а клиент в письме о брони. Минуты складывать
 * можно, поэтому вся арифметика идёт в минутах, а строка появляется только на
 * границе: при разборе входных данных и при выводе.
 *
 * Формат строки жёсткий — `HH:mm`, 24 часа, ведущий ноль. Это внутренний
 * машинный вид (он же в БД и в фикстурах), а НЕ то, что видит пользователь:
 * человеческий вид даёт `useFormatter().dateTime(date, 'slotTime')` по правилам
 * локали. Смешивать эти два уровня — прямой путь к «6:00 PM» на армянской
 * странице.
 *
 * Библиотека дат не нужна: здесь нет ни календаря, ни часовых поясов, ни
 * переходов на летнее время — только целые минуты и остаток от деления.
 * Сигнатуры зафиксированы в `docs/09-helpers-catalog.md` §2.
 */

/** Минут в сутках. Математическая константа, а не настройка платформы. */
export const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_HOUR = 60;

export class ClockError extends Error {
  constructor(message: string) {
    super(`[clock] ${message}`);
    this.name = 'ClockError';
  }
}

/**
 * Строгий разбор `HH:mm`.
 *
 * Регулярное выражение проверяет диапазон, а не только форму: `'25:00'` и
 * `'18:70'` — не время, и лучше узнать об этом при разборе, чем получить слот в
 * 25 часов в расписании. `'7:00'` тоже ошибка: без ведущего нуля строки
 * перестают сортироваться лексикографически, а на этом свойстве держится
 * порядок слотов в запросах к БД.
 */
export function parseClock(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new ClockError(`Ожидался формат HH:mm, получено: "${value}"`);
  return Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]);
}

/** Разбор без исключения — для пользовательского ввода и данных извне. */
export function tryParseClock(value: string): number | null {
  try {
    return parseClock(value);
  } catch {
    return null;
  }
}

/**
 * Минуты → `HH:mm`.
 *
 * Значение приводится по модулю суток, поэтому 1440 (полночь следующего дня)
 * даёт `'00:00'`, а −30 — `'23:30'`. Это осознанно: «занятие в 23:00 длится два
 * часа» не должно бросать исключение при вычислении времени окончания.
 * Отвечать на вопрос «а не перешли ли мы через полночь» должен вызывающий код —
 * у него есть дата, у этой функции её нет.
 */
export function formatClock(minutes: number): string {
  if (!Number.isFinite(minutes)) {
    throw new ClockError(`Минуты не являются числом: ${minutes}`);
  }
  if (!Number.isInteger(minutes)) {
    throw new ClockError(`Минуты должны быть целыми: ${minutes}`);
  }
  const normalized = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / MINUTES_PER_HOUR);
  const rest = normalized % MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/**
 * Приведение к сетке расписания.
 *
 * `direction: 'up'` нужен там, где округление вниз означало бы предложить слот в
 * прошлом: «сейчас 18:07, ближайший слот» — это 18:30, а не 18:00.
 */
export function alignToGranularity(
  minutes: number,
  granularity: number,
  direction: 'down' | 'up' = 'down',
): number {
  if (!Number.isInteger(granularity) || granularity <= 0) {
    throw new ClockError(`Шаг сетки должен быть целым положительным: ${granularity}`);
  }
  const steps = minutes / granularity;
  return (direction === 'up' ? Math.ceil(steps) : Math.floor(steps)) * granularity;
}

/** Лежит ли время ровно на сетке. Используется валидацией расписаний. */
export function isAlignedToGranularity(minutes: number, granularity: number): boolean {
  return alignToGranularity(minutes, granularity) === minutes;
}

/**
 * Сдвиг времени суток на минуты: начало слота + длительность = конец слота.
 *
 * Отдельная функция, а не `formatClock(parseClock(x) + n)` по месту вызова:
 * именно это выражение нужно в карточке занятия, в сводке брони, в письме и в
 * `.ics`-файле, и разница в одном из них означает разное время в одном
 * бронировании.
 */
export function shiftClock(value: string, deltaMinutes: number): string {
  return formatClock(parseClock(value) + deltaMinutes);
}

/** Длительность между двумя временами суток. Через полночь считает вперёд. */
export function clockDifference(from: string, to: string): number {
  const diff = parseClock(to) - parseClock(from);
  return diff >= 0 ? diff : diff + MINUTES_PER_DAY;
}

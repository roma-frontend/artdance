/**
 * ПРАЗДНИКИ РЕСПУБЛИКИ АРМЕНИЯ — нерабочие дни как данные, а не как догадка.
 *
 * Нужны в трёх местах, и в каждом ошибка стоит денег:
 *   • доступность по умолчанию — не предлагать 1 января занятие, которого не будет;
 *   • сроки доставки — «1–2 дня» через 31 декабря означают 3 января;
 *   • ожидаемое время ответа инструктора — «до 24 часов» не считается в праздник.
 *
 * **Список закрытый и фиксированный.** Закон РА «О праздниках и памятных днях»
 * объявляет нерабочими 13 дней, и все они привязаны к календарной дате, а не к
 * Пасхе: подвижные церковные даты (Вардананц, например) в законе есть, но
 * нерабочими не объявлены. Поэтому здесь нет вычисления Пасхи и нет зависимости
 * от библиотеки календарей — только месяц и день.
 *
 * **Почему это `src/domain/`, а не `src/config/`.** Праздники — не настройка
 * платформы, которую заказчик меняет по желанию: это внешний факт, как ставка НДС
 * в налоговом кодексе. В конфигурации живёт то, что бизнес решает сам
 * (`venue.defaultClosedWeekdays`, окна отмены); здесь — то, что бизнес обязан
 * учитывать. Смешивать значит однажды получить «а давайте поработаем 1 января»
 * правкой конфига вместо разговора с инструкторами.
 *
 * **Перенос праздника на будний день не применяется.** В РА нет правила «если
 * праздник в субботу, отдыхаем в понедельник»: нерабочим остаётся сам день.
 *
 * Дата считается в поясе бизнеса (`site.timeZone`): 1 января в Ереване и в UTC —
 * это разные моменты на четыре часа, и посетитель из Лондона не должен видеть
 * другой набор праздников.
 *
 * Сигнатуры зафиксированы в `docs/09-helpers-catalog.md` §2.
 */

import { site } from '@/config/site';
import { fromZonedParts, zonedParts } from '@/lib/time/schedule';

/**
 * Нерабочие праздники: `[месяц, день]` и ключ i18n названия.
 *
 * Названия — ключами, а не текстом: праздник показывается в календаре
 * доступности и в объяснении срока доставки, то есть попадает на три языка.
 */
const nonWorkingHolidays = [
  { month: 1, day: 1, nameKey: 'newYear' },
  { month: 1, day: 2, nameKey: 'newYearSecond' },
  { month: 1, day: 6, nameKey: 'christmas' },
  { month: 1, day: 27, nameKey: 'fallenRemembrance' },
  { month: 1, day: 28, nameKey: 'armyDay' },
  { month: 3, day: 8, nameKey: 'womensDay' },
  { month: 4, day: 24, nameKey: 'genocideRemembrance' },
  { month: 5, day: 1, nameKey: 'labourDay' },
  { month: 5, day: 9, nameKey: 'victoryDay' },
  { month: 5, day: 28, nameKey: 'republicDay' },
  { month: 7, day: 5, nameKey: 'constitutionDay' },
  { month: 9, day: 21, nameKey: 'independenceDay' },
  { month: 12, day: 31, nameKey: 'newYearEve' },
] as const;

export type HolidayNameKey = (typeof nonWorkingHolidays)[number]['nameKey'];

export interface PublicHoliday {
  /** Полночь праздничного дня в поясе бизнеса. */
  date: Date;
  /** Ключ внутри namespace `holidays` в `src/i18n/messages`. */
  nameKey: HolidayNameKey;
}

/** Выходные дни недели: суббота и воскресенье. `Date.getDay()`: 0 — воскресенье. */
const weekendDays: readonly number[] = [0, 6];

/**
 * Нерабочие праздники года с названиями. Порядок — календарный.
 *
 * Год параметром, а не «текущий»: горизонт бронирования 90 дней регулярно
 * перешагивает 31 декабря, и вызывающий код спрашивает про оба года.
 */
export function armenianPublicHolidaysDetailed(
  year: number,
  timeZone: string = site.timeZone,
): readonly PublicHoliday[] {
  return nonWorkingHolidays.map((holiday) => ({
    date: fromZonedParts(
      { year, month: holiday.month, day: holiday.day, minutesOfDay: 0 },
      timeZone,
    ),
    nameKey: holiday.nameKey,
  }));
}

/** Только даты — вход для `computeFreeSlots`, которому названия не нужны. */
export function armenianPublicHolidays(
  year: number,
  timeZone: string = site.timeZone,
): readonly Date[] {
  return armenianPublicHolidaysDetailed(year, timeZone).map((holiday) => holiday.date);
}

/**
 * Праздники, попадающие в диапазон дат.
 *
 * Отдельная функция, потому что диапазон почти всегда пересекает Новый год:
 * собирать праздники двух лет и фильтровать — это код, который иначе появился бы
 * в каждой вызывающей стороне по-своему.
 */
export function publicHolidaysBetween(
  from: Date,
  to: Date,
  timeZone: string = site.timeZone,
): readonly PublicHoliday[] {
  const firstYear = zonedParts(from, timeZone).year;
  const lastYear = zonedParts(to, timeZone).year;

  const all: PublicHoliday[] = [];
  for (let year = firstYear; year <= lastYear; year += 1) {
    all.push(...armenianPublicHolidaysDetailed(year, timeZone));
  }

  return all.filter(
    (holiday) => holiday.date.getTime() >= startOfZonedDay(from, timeZone).getTime()
      && holiday.date.getTime() <= to.getTime(),
  );
}

/** Полночь календарного дня в поясе бизнеса. */
export function startOfZonedDay(instant: Date, timeZone: string = site.timeZone): Date {
  const parts = zonedParts(instant, timeZone);
  return fromZonedParts(
    { year: parts.year, month: parts.month, day: parts.day, minutesOfDay: 0 },
    timeZone,
  );
}

/** Приходится ли момент на нерабочий праздник. */
export function isPublicHoliday(instant: Date, timeZone: string = site.timeZone): boolean {
  const parts = zonedParts(instant, timeZone);
  return nonWorkingHolidays.some(
    (holiday) => holiday.month === parts.month && holiday.day === parts.day,
  );
}

/** Название праздника для этой даты или `null`. */
export function publicHolidayNameKey(
  instant: Date,
  timeZone: string = site.timeZone,
): HolidayNameKey | null {
  const parts = zonedParts(instant, timeZone);
  const match = nonWorkingHolidays.find(
    (holiday) => holiday.month === parts.month && holiday.day === parts.day,
  );
  return match?.nameKey ?? null;
}

export function isWeekend(instant: Date, timeZone: string = site.timeZone): boolean {
  return weekendDays.includes(zonedParts(instant, timeZone).weekday);
}

/**
 * Рабочий день: не выходной и не праздник.
 *
 * Это НЕ то же самое, что «студия открыта»: танцевальные занятия идут как раз в
 * выходные, и расписание инструктора описывается своими правилами. `isWorkingDay`
 * отвечает на другой вопрос — «работают ли банк, курьер и поддержка», поэтому
 * применяется к срокам доставки и времени ответа, а не к доступности слотов.
 */
export function isWorkingDay(instant: Date, timeZone: string = site.timeZone): boolean {
  return !isWeekend(instant, timeZone) && !isPublicHoliday(instant, timeZone);
}

/**
 * Дата через N рабочих дней — срок доставки и обещание ответа.
 *
 * Считается по календарю, а не «плюс N дней»: заказ вечером 30 декабря с
 * доставкой «1–2 рабочих дня» приходит 5 января, и написать это честно можно
 * только так.
 */
export function addWorkingDays(
  from: Date,
  days: number,
  timeZone: string = site.timeZone,
): Date {
  const MS_PER_DAY = 24 * 60 * 60 * 1_000;
  let cursor = startOfZonedDay(from, timeZone);
  let remaining = Math.max(0, Math.trunc(days));

  while (remaining > 0) {
    /* Через полдень, а не ровно сутки: смещение пояса не даёт съехать на день. */
    cursor = startOfZonedDay(new Date(cursor.getTime() + MS_PER_DAY + MS_PER_DAY / 2), timeZone);
    if (isWorkingDay(cursor, timeZone)) remaining -= 1;
  }

  return cursor;
}

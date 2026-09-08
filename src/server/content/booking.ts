/**
 * Контент экрана бронирования.
 *
 * Тот же шов, что `home.ts` и `cart.ts`: расписание сегодня из демо-фикстур
 * прототипа, завтра из базы, компоненты не меняются.
 *
 * **Доступность считает движок, а не вёрстка.** `domain/availability/compute.ts`
 * разворачивает правила расписания в окна, вырезает занятое время с буфером и
 * нарезает остаток на слоты по сетке `slotGranularityMinutes`. Здесь остаётся
 * только собрать вход: правила инструктора, занятое время, «сейчас» и числа из
 * `config/business.ts`.
 *
 * **Занятые слоты остаются на экране зачёркнутыми, а не исчезают.** Это из
 * макета, и это правильно: пустая сетка не отвечает на вопрос «а когда вообще
 * бывает». Поэтому движок вызывается дважды — один раз без занятого времени
 * (получается сетка дня) и один раз с ним (получается свободное). Разница между
 * наборами и есть «занято».
 *
 * **Доступность НЕ кешируется** (`dataRevalidate.availability = 0`): устаревший
 * ответ означает двойную бронь. Маршрут бронирования лежит в `privatePaths`
 * (`no-store`), функция не оборачивается ни в `unstable_cache`, ни в теги.
 *
 * **Что здесь остаётся заглушкой до задачи 2.1.** Занятое время берётся из трёх
 * зачёркнутых времён макета, а не из `Booking` и `SlotHold`; исключения
 * расписания (отпуск, разовое окно) пусты. Форма входа при этом уже настоящая:
 * появление базы меняет источники массивов, а не движок и не компоненты.
 */

import 'server-only';

import {
  demoClasses,
  demoInstructorAvailability,
  demoInstructors,
  demoSelectedSlot,
  demoTakenSlots,
  demoVenues,
} from '../../../prisma/fixtures/demo';
import type { TimeSlot } from '@/components/booking/time-slot-picker';
import { booking } from '@/config';
import { site } from '@/config/site';
import {
  computeFreeSlots,
  groupSlotsByDay,
  nextAvailableSlots,
  type AvailabilityInput,
  type AvailabilityRule,
} from '@/domain/availability/compute';
import type { InstructorCardItem } from '@/domain/content';
import type { Money } from '@/domain/money';
import { publicHolidaysBetween } from '@/domain/holidays';
import { formatClock, parseClock } from '@/lib/time/clock';
import type { Interval } from '@/lib/time/interval';
import { fromZonedParts, zonedParts } from '@/lib/time/schedule';

import { mediaRef } from './media';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

/** День с доступностью: календарная дата и сетка времён этого дня. */
export interface BookingDay {
  /** `YYYY-MM-DD` в поясе бизнеса — ключ, а не момент: сравнение идёт по суткам. */
  dateKey: string;
  /** Полночь этого дня в поясе бизнеса, ISO. Нужен календарю. */
  dateIso: string;
  /** Времена дня: занятые остаются в списке недоступными. */
  slots: readonly TimeSlot[];
}

/** Ближайшее свободное время: момент для показа даты и время суток для подписи. */
export interface AlternativeSlot {
  /** Момент начала, ISO. Формат даты и времени выбирает локаль на клиенте. */
  startIso: string;
  /** Машинное время суток `HH:mm` — для подписи интервала. */
  startTime: string;
  endTime: string;
}

export interface BookingContent {
  instructorSlug: string;
  instructorName: string;
  /** Занятие, которое бронируется. */
  classTitle: string;
  classSlug: string;
  studioName: string;
  durationMinutes: number;
  fee: Money;
  /**
   * Дни, в которые инструктор принимает, в пределах горизонта бронирования.
   * Пустой массив — свободных дней нет, и календарь показывает это отдельным
   * состоянием, а не молча серой сеткой.
   */
  days: readonly BookingDay[];
  /** День, открытый при входе на экран: первый с доступностью. */
  initialDateKey: string | null;
  /** Слот, предвыбранный при открытии страницы (в макете — 18:00). */
  preselectedSlot: string | null;
  /** Инструктор выезжает к клиенту. В production — поле профиля. */
  acceptsTravel: boolean;
  acceptsOnline: boolean;
}

/** Окна фикстур → правила движка. Форма совпадает с `AvailabilityRule` в схеме. */
function availabilityRulesFor(instructorSlug: string): readonly AvailabilityRule[] {
  return (demoInstructorAvailability[instructorSlug] ?? []).map((window) => ({
    weekday: window.weekday,
    startTime: window.startTime,
    endTime: window.endTime,
  }));
}

/**
 * Занятое время инструктора.
 *
 * Заглушка: три зачёркнутых времени макета повторяются в каждый рабочий день
 * горизонта. В production это выборка `Booking` и непросроченных `SlotHold` по
 * инструктору за тот же диапазон — функция меняется целиком, вход движка нет.
 */
function busyIntervalsFor(
  rules: readonly AvailabilityRule[],
  range: Interval,
  durationMinutes: number,
): readonly Interval[] {
  const workingWeekdays = new Set(rules.map((rule) => rule.weekday));
  const takenMinutes = demoTakenSlots.map(parseClock);
  const busy: Interval[] = [];

  for (
    let cursor = range.start.getTime();
    cursor < range.end.getTime();
    cursor += MS_PER_DAY
  ) {
    const parts = zonedParts(new Date(cursor));
    if (!workingWeekdays.has(parts.weekday)) continue;

    for (const minutesOfDay of takenMinutes) {
      const start = fromZonedParts({
        year: parts.year,
        month: parts.month,
        day: parts.day,
        minutesOfDay,
      });
      busy.push({ start, end: new Date(start.getTime() + durationMinutes * MS_PER_MINUTE) });
    }
  }

  return busy;
}

/** Время суток слота в машинном виде `HH:mm` — то, что понимает `TimeSlotPicker`. */
function slotClock(instant: Date): string {
  return formatClock(zonedParts(instant).minutesOfDay);
}

/**
 * Данные для бронирования занятия у инструктора.
 *
 * Возвращает `null`, если инструктора нет или у него нет занятий: страница
 * отвечает 404, а не рисует пустую сводку.
 *
 * `now` параметром: экран рендерится на сервере, но тест доступности не должен
 * зависеть от дня, в который его запустили.
 */
/**
 * Вход движка доступности для одного инструктора.
 *
 * Одна функция на все вопросы о его расписании: и «что свободно в календаре», и
 * «когда ближайшее» (C-02). Два разных сбора входа означали бы два разных ответа
 * на один вопрос — например, альтернативы, предлагающие уже занятое время.
 */
function availabilityInputFor(
  instructorSlug: string,
  durationMinutes: number,
  now: Date,
): AvailabilityInput {
  const rules = availabilityRulesFor(instructorSlug);

  /*
   * Диапазон — весь горизонт бронирования: календарю нужно знать, какие дни
   * вообще открыты, иначе человек выбирает дату и получает пустую сетку. Слотов
   * при этом немного (несколько рабочих дней в неделю), и они не кешируются.
   */
  const range: Interval = {
    start: new Date(now.getTime()),
    end: new Date(now.getTime() + booking.maxAdvanceDays * MS_PER_DAY),
  };

  return {
    rules,
    /* Отпуска и разовые окна появятся вместе с расписанием инструктора. */
    exceptions: [],
    busy: busyIntervalsFor(rules, range, durationMinutes),
    holidays: publicHolidaysBetween(range.start, range.end).map((holiday) => holiday.date),
    range,
    durationMinutes,
    granularityMinutes: booking.slotGranularityMinutes,
    bufferMinutes: booking.bufferBetweenBookingsMinutes,
    minLeadMinutes: booking.minLeadTimeMinutes,
    maxAdvanceDays: booking.maxAdvanceDays,
    now,
    timeZone: site.timeZone,
  };
}

/**
 * Данные для бронирования занятия у инструктора.
 *
 * Возвращает `null`, если инструктора нет или у него нет занятий: страница
 * отвечает 404, а не рисует пустую сводку.
 *
 * `now` параметром: экран рендерится на сервере, но тест доступности не должен
 * зависеть от дня, в который его запустили.
 */
export function getInstructorBookingContent(
  slug: string,
  now: Date = new Date(),
): BookingContent | null {
  const instructor = demoInstructors.find((item) => item.slug === slug);
  if (!instructor) return null;

  /*
   * Занятие, которое инструктор ведёт. В production бронируется конкретный
   * `ClassSession`, и его id приходит параметром запроса из карточки занятия.
   */
  const classItem = demoClasses.find((item) => item.instructorSlug === slug);
  if (!classItem) return null;

  const venue = demoVenues.find((item) => item.slug === classItem.venueSlug);
  const input = availabilityInputFor(slug, classItem.durationMinutes, now);

  /*
   * Сетка дня — тот же расчёт без занятого времени. Без него занятые времена
   * просто исчезали бы, и день выглядел бы менее рабочим, чем он есть.
   */
  const grid = computeFreeSlots({ ...input, busy: [], bufferMinutes: 0 });
  const free = new Set(computeFreeSlots(input).map((slot) => slot.start.getTime()));

  const days: BookingDay[] = groupSlotsByDay(grid, site.timeZone).map((day) => ({
    dateKey: day.dateKey,
    dateIso: day.date.toISOString(),
    slots: day.slots.map((slot) => ({
      start: slotClock(slot.start),
      available: free.has(slot.start.getTime()),
    })),
  }));

  const initialDay = days.find((day) => day.slots.some((slot) => slot.available)) ?? days[0] ?? null;

  return {
    instructorSlug: instructor.slug,
    instructorName: instructor.name,
    classTitle: classItem.title,
    classSlug: classItem.slug,
    studioName: venue?.name ?? '',
    durationMinutes: classItem.durationMinutes,
    fee: classItem.price,
    days,
    initialDateKey: initialDay?.dateKey ?? null,
    preselectedSlot: preselectedSlotFor(initialDay),
    acceptsTravel: true,
    acceptsOnline: true,
  };
}

/**
 * Что выбрать за человека при открытии экрана.
 *
 * Время из макета, если оно свободно; иначе первое свободное этого дня. Ничего не
 * выбирать нельзя: сводка справа без слота — пустой блок с неактивной кнопкой,
 * и человек не понимает, чего от него ждут.
 */
function preselectedSlotFor(day: BookingDay | null): string | null {
  if (!day) return null;
  const preferred = day.slots.find((slot) => slot.start === demoSelectedSlot && slot.available);
  return (preferred ?? day.slots.find((slot) => slot.available))?.start ?? null;
}

/**
 * Ближайшие свободные времена у инструктора — фича C-02 бэклога.
 *
 * «Мест нет» без предложения — потерянный клиент, и это самая дорогая точка
 * отказа в продукте: человек уже выбрал направление, инструктора и цену.
 * Поэтому заполненная группа обязана отвечать «а вот когда можно», причём
 * временами, которые действительно свободны, — то есть теми же, что покажет
 * экран бронирования.
 *
 * Пустой массив — легальный ответ: у инструктора может не быть окон в горизонте.
 * Тогда экран показывает лист ожидания, а не пустой блок с заголовком.
 *
 * `null` — инструктора нет. Это не то же самое, что «нет времени»: подменять
 * первое вторым значит скрыть битую ссылку от того, кто её поставил.
 */
export function getAlternativeSlots(
  instructorSlug: string,
  count: number,
  now: Date = new Date(),
): readonly AlternativeSlot[] | null {
  const instructor = demoInstructors.find((item) => item.slug === instructorSlug);
  if (!instructor) return null;

  const classItem = demoClasses.find((item) => item.instructorSlug === instructorSlug);
  if (!classItem) return [];

  const input = availabilityInputFor(instructorSlug, classItem.durationMinutes, now);

  return nextAvailableSlots(input, count).map((slot) => ({
    startIso: slot.start.toISOString(),
    startTime: slotClock(slot.start),
    endTime: slotClock(slot.end),
  }));
}

/** Инструкторы, к которым открыто бронирование: для страницы входа в поток. */export function getBookableInstructors(): readonly InstructorCardItem[] {
  /* Только те, у кого есть занятие: ссылка на бронирование обязана открываться. */
  return demoInstructors
    .filter((instructor) => demoClasses.some((item) => item.instructorSlug === instructor.slug))
    .map((instructor) => ({
      slug: instructor.slug,
      name: instructor.name,
      headline: instructor.headline,
      styles: instructor.styles,
      yearsExperience: instructor.yearsExperience,
      hourlyRateFrom: instructor.hourlyRateFrom,
      ratingAverage: instructor.ratingAverage,
      ratingCount: instructor.ratingCount,
      isVerified: instructor.isVerified,
      image: mediaRef(instructor.asset),
    }));
}

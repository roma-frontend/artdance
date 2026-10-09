/**
 * Контент экрана бронирования.
 *
 * Публичный профиль и занятие читаются из Prisma; расписание, исключения,
 * блокирующие брони и непросроченные удержания перечитываются без кеша.
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
 * Переход с занятия передаёт его слаг: календарь показывает ClassSession с ID,
 * временем и остатком мест. Прямой вход от инструктора сохраняет индивидуальную
 * сетку; онлайн-формат без соответствующего поля в схеме не предлагается.
 */

import 'server-only';

import { db } from '@/lib/db';
import { defaultLocale, type Locale } from '@/i18n/config';
import { slotBlockingBookingStatuses } from '@/domain/enums';
import { publicInstructorWhere, instructorSelect, toInstructorCard } from '../queries/instructors';
import { publicClassWhere } from '../queries/classes';
import { notTrashed } from '../queries/relations';
import type { TimeSlot } from '@/components/booking/time-slot-picker';
import { booking, limits } from '@/config';
import { site } from '@/config/site';
import {
  computeFreeSlots,
  groupSlotsByDay,
  nextAvailableSlots,
  zonedDateKey,
  type AvailabilityInput,
} from '@/domain/availability/compute';
import type { InstructorCardItem } from '@/domain/content';
import type { Money } from '@/domain/money';
import { publicHolidaysBetween, startOfZonedDay } from '@/domain/holidays';
import { formatClock } from '@/lib/time/clock';
import type { Interval } from '@/lib/time/interval';
import { zonedParts } from '@/lib/time/schedule';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

/** День с доступностью: календарная дата и сетка времён этого дня. */
export interface BookingDay {
  /** `YYYY-MM-DD` в поясе бизнеса — ключ, а не момент: сравнение идёт по суткам. */
  dateKey: string;
  /** Полночь этого дня в поясе бизнеса, ISO. Нужен календарю. */
  dateIso: string;
  /** Времена дня: занятые остаются в списке недоступными. */
  slots: ReadonlyArray<TimeSlot & { sessionId?: string; endIso?: string }>;
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
  /** Первое свободное время начального дня. */
  preselectedSlot: string | null;
  /** Инструктор выезжает к клиенту — поле профиля. */
  acceptsTravel: boolean;
  acceptsOnline: boolean;
  instructorId: string;
  venueSlug: string | null;
  /** Групповой календарь: только реальные проведения выбранного занятия. */
  sessionBooking?: boolean;
}

/** Публичный инструктор существует, но занятие для записи ещё не опубликовано. */
export interface InstructorBookingEmpty {
  kind: 'no-classes';
  instructorSlug: string;
  instructorName: string;
}

async function bookingSubject(slug: string, locale: Locale = defaultLocale, classSlug?: string) {
  const instructor = await db.instructorProfile.findFirst({
    where: { slug, ...publicInstructorWhere },
    select: { id: true, slug: true, acceptsTravel: true, user: { select: { name: true } } },
  });
  if (!instructor) return null;
  const classItem = await db.danceClass.findFirst({
    where: { ...publicClassWhere, instructorId: instructor.id, ...(classSlug ? { slug: classSlug } : {}) },
    orderBy: { id: 'asc' },
    select: {
      id: true, slug: true, title: true, price: true, durationMinutes: true,
      translations: { where: { locale }, select: { title: true } },
      venue: { select: { slug: true, name: true, deletedAt: true,
        translations: { where: { locale }, select: { name: true } } } },
    },
  });
  return { instructor, classItem };
}

/** Время суток слота в машинном виде `HH:mm` — то, что понимает `TimeSlotPicker`. */
function slotClock(instant: Date): string {
  return formatClock(zonedParts(instant).minutesOfDay);
}

/**
 * Вход движка доступности для одного инструктора.
 *
 * Одна функция на все вопросы о его расписании: и «что свободно в календаре», и
 * «когда ближайшее» (C-02). Два разных сбора входа означали бы два разных ответа
 * на один вопрос — например, альтернативы, предлагающие уже занятое время.
 */
async function availabilityInputFor(
  instructorId: string,
  durationMinutes: number,
  now: Date,
): Promise<AvailabilityInput> {

  /*
   * Диапазон — весь горизонт бронирования: календарю нужно знать, какие дни
   * вообще открыты, иначе человек выбирает дату и получает пустую сетку. Слотов
   * при этом немного (несколько рабочих дней в неделю), и они не кешируются.
   */
  const range: Interval = {
    start: startOfZonedDay(now, site.timeZone),
    end: new Date(now.getTime() + booking.maxAdvanceDays * MS_PER_DAY),
  };

  const overlap = {
    startsAt: { lt: range.end },
    endsAt: { gt: new Date(range.start.getTime() - booking.bufferBetweenBookingsMinutes * MS_PER_MINUTE) },
  };
  const [rules, exceptions, bookings, holds] = await Promise.all([
    db.availabilityRule.findMany({ where: { instructorId, isActive: true } }),
    db.availabilityException.findMany({ where: { instructorId, ...overlap } }),
    db.booking.findMany({
      where: { instructorId, ...overlap, status: { in: [...slotBlockingBookingStatuses] } },
      select: { startsAt: true, endsAt: true },
    }),
    db.slotHold.findMany({
      where: { instructorId, ...overlap, expiresAt: { gt: now } },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  return {
    rules,
    exceptions: exceptions.map((row) => ({ start: row.startsAt, end: row.endsAt, isAvailable: row.isAvailable })),
    busy: [...bookings, ...holds].map((row) => ({ start: row.startsAt, end: row.endsAt })),
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
 * `null` — профиль отсутствует/непубличный или явно запрошенное занятие не найдено.
 * `no-classes` — существующий публичный профиль без занятия: полноценное пустое
 * состояние, без выдуманных цен, календаря и запросов удержания.
 *
 * `now` параметром: экран рендерится на сервере, но тест доступности не должен
 * зависеть от дня, в который его запустили.
 */
export async function getInstructorBookingContent(
  slug: string,
  now: Date = new Date(),
  locale: Locale = defaultLocale,
  classSlug?: string,
): Promise<BookingContent | InstructorBookingEmpty | null> {
  const subject = await bookingSubject(slug, locale, classSlug);
  if (!subject) return null;
  if (!subject.classItem) {
    if (classSlug) return null;
    return { kind: 'no-classes', instructorSlug: subject.instructor.slug, instructorName: subject.instructor.user.name };
  }
  const { instructor, classItem } = subject;
  const venue = classItem.venue?.deletedAt === null ? classItem.venue : null;
  if (classSlug) {
    const range = {
      start: startOfZonedDay(now, site.timeZone),
      end: new Date(now.getTime() + booking.maxAdvanceDays * MS_PER_DAY),
    };
    const sessions = await db.classSession.findMany({
      where: {
        ...notTrashed, classId: classItem.id, isCancelled: false,
        startsAt: {
          gte: new Date(now.getTime() + booking.minLeadTimeMinutes * MS_PER_MINUTE),
          lt: range.end,
        },
      },
      orderBy: { startsAt: 'asc' },
      select: { id: true, startsAt: true, endsAt: true, capacity: true, bookedCount: true },
    });
    const [sessionBookings, activeHolds] = await Promise.all([
      db.booking.findMany({
        where: { instructorId: instructor.id, status: { in: [...slotBlockingBookingStatuses] },
          startsAt: { lt: range.end }, endsAt: { gt: range.start } },
        select: { startsAt: true, endsAt: true, sessionId: true },
      }),
      db.slotHold.findMany({
        where: { instructorId: instructor.id, expiresAt: { gt: now },
          startsAt: { lt: range.end }, endsAt: { gt: range.start } },
        select: { startsAt: true, endsAt: true },
      }),
    ]);
    const days: BookingDay[] = [];
    for (const session of sessions) {
      const date = startOfZonedDay(session.startsAt, site.timeZone);
      const dateKey = zonedDateKey(session.startsAt, site.timeZone);
      let day = days.find(item => item.dateKey === dateKey);
      if (!day) {
        day = { dateKey, dateIso: date.toISOString(), slots: [] };
        days.push(day);
      }
      const bufferMs = booking.bufferBetweenBookingsMinutes * MS_PER_MINUTE;
      const occupied = [...sessionBookings.filter(row => row.sessionId !== session.id), ...activeHolds]
        .some(row => row.startsAt.getTime() < session.endsAt.getTime() + bufferMs
          && row.endsAt.getTime() > session.startsAt.getTime() - bufferMs);
      const available = session.bookedCount < session.capacity && !occupied;
      day.slots = [...day.slots, {
        start: slotClock(session.startsAt), available,
        sessionId: session.id, endIso: session.endsAt.toISOString(),
      }];
    }
    const initial = days.find(day => day.slots.some(slot => slot.available)) ?? days[0] ?? null;
    return {
      instructorSlug: instructor.slug, instructorId: instructor.id,
      instructorName: instructor.user.name,
      classTitle: classItem.translations[0]?.title ?? classItem.title,
      classSlug: classItem.slug,
      studioName: venue?.translations[0]?.name ?? venue?.name ?? '',
      venueSlug: venue?.slug ?? null,
      durationMinutes: classItem.durationMinutes, fee: classItem.price,
      acceptsTravel: false, acceptsOnline: false, sessionBooking: true,
      days, initialDateKey: initial?.dateKey ?? null, preselectedSlot: preselectedSlotFor(initial),
    };
  }

  const input = await availabilityInputFor(instructor.id, classItem.durationMinutes, now);

  /*
   * Сетка дня — тот же расчёт, но якорённый к НАЧАЛУ СУТОК и без лид-тайма:
   * без этого утренние слоты сегодняшнего рабочего дня исчезают из сетки
   * целиком — и до наступления лид-тайма (сейчас), и после (10:04 уже «позже
   * 10:00»), и день выглядит менее рабочим, чем он есть. Слишком раннее для
   * брони время остаётся в сетке недоступным: доступность берётся из полного
   * расчёта (с лид-таймом и занятым временем), а сетка отвечает только за
   * состав дня.
   */
  const dayStart = startOfZonedDay(now, site.timeZone);
  const grid = computeFreeSlots({
    ...input,
    now: dayStart,
    range: { start: dayStart, end: input.range.end },
    minLeadMinutes: 0,
    busy: [],
    bufferMinutes: 0,
  });
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
    instructorName: instructor.user.name,
    classTitle: classItem.translations[0]?.title ?? classItem.title,
    classSlug: classItem.slug,
    studioName: venue?.translations[0]?.name ?? venue?.name ?? '',
    durationMinutes: classItem.durationMinutes,
    fee: classItem.price,
    days,
    initialDateKey: initialDay?.dateKey ?? null,
    preselectedSlot: preselectedSlotFor(initialDay),
    acceptsTravel: instructor.acceptsTravel,
    // Онлайн-формат не объявлен в схеме: не обещаем его вместо данных.
    acceptsOnline: false,
    instructorId: instructor.id,
    venueSlug: venue?.slug ?? null,
  };
}

/**
 * Что выбрать за человека при открытии экрана.
 *
 * Первое свободное время дня; null, если весь день занят.
 */
function preselectedSlotFor(day: BookingDay | null): string | null {
  if (!day) return null;
  return day.slots.find((slot) => slot.available)?.start ?? null;
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
export async function getAlternativeSlots(
  instructorSlug: string,
  count: number,
  now: Date = new Date(),
): Promise<readonly AlternativeSlot[] | null> {
  const subject = await bookingSubject(instructorSlug);
  if (!subject) return null;
  if (!subject.classItem) return [];
  const input = await availabilityInputFor(subject.instructor.id, subject.classItem.durationMinutes, now);

  return nextAvailableSlots(input, count).map((slot) => ({
    startIso: slot.start.toISOString(),
    startTime: slotClock(slot.start),
    endTime: slotClock(slot.end),
  }));
}

/** Публичные инструкторы с действующим занятием. Без кеша. */
export async function getBookableInstructors(locale: Locale = defaultLocale): Promise<readonly InstructorCardItem[]> {
  const rows = await db.instructorProfile.findMany({
    where: { ...publicInstructorWhere, classes: { some: { ...notTrashed, ...publicClassWhere } } },
    orderBy: { id: 'asc' },
    take: limits.query.maxRows,
    select: { ...instructorSelect, translations: { where: { locale }, select: { headline: true } } },
  });
  return rows.map((row) => toInstructorCard({ ...row, headline: row.translations[0]?.headline ?? row.headline }));
}

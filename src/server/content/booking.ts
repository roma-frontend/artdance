/**
 * Контент экрана бронирования.
 *
 * Тот же шов, что `home.ts` и `cart.ts`: данные сегодня из демо-фикстур
 * прототипа, завтра из базы, компоненты не меняются.
 *
 * **Доступность слотов НЕ кешируется** (`dataRevalidate.availability = 0`):
 * устаревший ответ означает двойную бронь. Поэтому маршрут бронирования лежит в
 * `privatePaths` (`no-store`), а не в каталоге, и функция не оборачивается ни в
 * `unstable_cache`, ни в теги.
 *
 * **Занятые слоты приходят данными, а не вычисляются в компоненте.** В макете
 * три времени зачёркнуты стилем; в продукте «занято» — это `Booking` плюс
 * действующий `SlotHold`, и решение принимается на сервере.
 *
 * Чего здесь пока нет и что появится с задачей 2.1: `availableDates` остаётся
 * `undefined` — «доступность неизвестна, выбирается любой день в горизонте».
 * Это честнее выдуманного календаря: `InstructorAvailability` и исключения
 * появятся вместе с расписанием инструктора.
 */

import 'server-only';

import {
  demoAvailableSlots,
  demoClasses,
  demoInstructors,
  demoSelectedSlot,
  demoTakenSlots,
  demoVenues,
} from '../../../prisma/fixtures/demo';
import type { TimeSlot } from '@/components/booking/time-slot-picker';
import { booking } from '@/config';
import type { HomeInstructorCard } from '@/domain/content';
import type { Money } from '@/domain/money';

import { mediaRef } from './media';

export interface BookingContent {
  instructorSlug: string;
  instructorName: string;
  /** Занятие, которое бронируется. `null` — частный урок без привязки к группе. */
  classTitle: string;
  classSlug: string;
  studioName: string;
  durationMinutes: number;
  fee: Money;
  slots: readonly TimeSlot[];
  /** Слот, предвыбранный при открытии страницы (в макете — 18:00). */
  preselectedSlot: string | null;
  /**
   * Первый день, на который можно бронировать: «сейчас» плюс
   * `booking.minLeadTimeMinutes`. Момент считает сервер и передаёт строкой ISO —
   * часы браузера могут быть неверны, а «сегодня» у клиента в другом часовом
   * поясе означало бы другой день.
   */
  earliestDateIso: string;
  /** Инструктор выезжает к клиенту. В production — поле профиля. */
  acceptsTravel: boolean;
  acceptsOnline: boolean;
}

/**
 * Данные для бронирования занятия у инструктора.
 *
 * Возвращает `null`, если инструктора нет или у него нет занятий: страница
 * отвечает 404, а не рисует пустую сводку.
 */
export function getInstructorBookingContent(slug: string): BookingContent | null {
  const instructor = demoInstructors.find((item) => item.slug === slug);
  if (!instructor) return null;

  /*
   * Занятие, которое инструктор ведёт. В production бронируется конкретный
   * `ClassSession`, и его id приходит параметром запроса из карточки занятия.
   */
  const classItem = demoClasses.find((item) => item.instructorSlug === slug);
  if (!classItem) return null;

  const venue = demoVenues.find((item) => item.slug === classItem.venueSlug);

  const taken = new Set<string>(demoTakenSlots);

  /*
   * Раньше, чем через `minLeadTimeMinutes`, бронировать нельзя: инструктору
   * нужно время, чтобы увидеть запись. Правило из конфигурации, а не «завтра».
   */
  const earliest = new Date(Date.now() + booking.minLeadTimeMinutes * 60_000);

  return {
    instructorSlug: instructor.slug,
    instructorName: instructor.name,
    classTitle: classItem.title,
    classSlug: classItem.slug,
    studioName: venue?.name ?? '',
    durationMinutes: classItem.durationMinutes,
    fee: classItem.price,
    slots: demoAvailableSlots.map((start) => ({ start, available: !taken.has(start) })),
    preselectedSlot: taken.has(demoSelectedSlot) ? null : demoSelectedSlot,
    earliestDateIso: earliest.toISOString(),
    acceptsTravel: true,
    acceptsOnline: true,
  };
}

/** Инструкторы, к которым открыто бронирование: для страницы входа в поток. */
export function getBookableInstructors(): readonly HomeInstructorCard[] {
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

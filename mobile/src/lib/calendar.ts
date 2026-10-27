import { createEventInCalendarAsync } from 'expo-calendar/legacy';

import { nextClassStart } from './class-time';

const YEREVAN_OFFSET = '+04:00';

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

type CalendarInput =
  | { kind: 'class'; title: string; weekday: number; startTime: string; durationMinutes: number; venue?: string; url: string }
  | { kind: 'event'; title: string; startsAt: string; startTime: string; endTime: string; venue?: string; url: string };

/**
 * Открывает системный диалог добавления события в календарь телефона.
 * Диалог сам запрашивает доступ, поэтому отдельное разрешение приложению не нужно.
 */
export async function addToCalendar(input: CalendarInput): Promise<boolean> {
  let startDate: Date;
  let endDate: Date;

  if (input.kind === 'class') {
    startDate = nextClassStart(input.weekday, input.startTime, Date.now());
    endDate = addMinutes(startDate, input.durationMinutes);
  } else {
    const day = input.startsAt.slice(0, 10);
    startDate = new Date(`${day}T${input.startTime}:00${YEREVAN_OFFSET}`);
    endDate = new Date(`${day}T${input.endTime}:00${YEREVAN_OFFSET}`);
    if (endDate <= startDate) endDate = addMinutes(startDate, 60);
  }

  return saveEvent({ title: input.title, startDate, endDate, venue: input.venue, url: input.url });
}

/** Добавляет уже забронированное занятие: время берётся из брони, поэтому пересчёт не нужен. */
export async function addBookingToCalendar(input: { title: string; startsAt: string; endsAt: string; venue?: string; url: string }): Promise<boolean> {
  const startDate = new Date(input.startsAt);
  let endDate = new Date(input.endsAt);
  if (endDate <= startDate) endDate = addMinutes(startDate, 60);
  return saveEvent({ title: input.title, startDate, endDate, venue: input.venue, url: input.url });
}

async function saveEvent(input: { title: string; startDate: Date; endDate: Date; venue?: string; url: string }): Promise<boolean> {
  const result = await createEventInCalendarAsync(
    {
      title: input.title,
      startDate: input.startDate,
      endDate: input.endDate,
      location: input.venue,
      notes: input.url,
      timeZone: 'Asia/Yerevan',
    },
    {},
  );
  // На Android `action` всегда `done`, поэтому само закрытие диалога считаем успехом.
  return result.action !== 'canceled';
}

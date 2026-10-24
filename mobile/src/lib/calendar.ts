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

  const result = await createEventInCalendarAsync(
    {
      title: input.title,
      startDate,
      endDate,
      location: input.venue,
      notes: input.url,
      timeZone: 'Asia/Yerevan',
    },
    {},
  );
  // На Android `action` всегда `done`, поэтому само закрытие диалога считаем успехом.
  return result.action !== 'canceled';
}

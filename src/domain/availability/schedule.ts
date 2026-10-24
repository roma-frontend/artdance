/**
 * SCHEDULE — правила формы расписания инструктора.
 *
 * Страница `/studio/availability` принимает данные из формы, а форма врёт.
 * Здесь живут правила, превращающие «то, что прислал браузер» в значения,
 * которые можно писать в `AvailabilityRule` и `AvailabilityException`:
 *
 *  • время — строгий `HH:mm` (тот же парсер, что у движка доступности);
 *  • окно не пустое и начало раньше конца (внутри суток, переход через
 *    полночь выражается двумя правилами, а не хитрым окном);
 *  • день недели — целое 0..6, где 0 — воскресенье, как в `Date.getDay()`;
 *  • даты правил/исключений — YYYY-MM-DD, конец не раньше начала.
 *
 * Почему Zod, а не ручные проверки: действия объявлены через
 * `next-safe-action`, и входная схема здесь же служит границей публичного
 * эндпоинта.
 */

import { z } from 'zod';

import { tryParseClock } from '@/lib/time/clock';
import { fromZonedParts } from '@/lib/time/schedule';

/** Дней недели в регулярном расписании: 0 = воскресенье … 6 = суббота. */
export const SCHEDULE_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const clockSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'HH:mm');

const daySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

export const scheduleRuleSchema = z
  .object({
    id: z.string().trim().min(1).max(64).optional(),
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: clockSchema,
    endTime: clockSchema,
    validFrom: daySchema.optional().or(z.literal('')),
    validUntil: daySchema.optional().or(z.literal('')),
    isActive: z.coerce.boolean().optional().default(true),
  })
  .refine((rule) => {
    const from = tryParseClock(rule.startTime);
    const to = tryParseClock(rule.endTime);
    return from !== null && to !== null && from < to;
  }, 'timeWindow');

export const scheduleExceptionSchema = z
  .object({
    id: z.string().trim().min(1).max(64).optional(),
    // Даты с_LocalTime-семантикой: исключение держит календарный интервал.
    date: daySchema,
    startTime: clockSchema,
    endTime: clockSchema,
    /** true = разовое рабочее окно вопреки правилам, false = блокировка. */
    isAvailable: z.coerce.boolean().optional().default(false),
    reason: z.string().trim().max(160).optional().or(z.literal('')),
  })
  .refine((item) => {
    const from = tryParseClock(item.startTime);
    const to = tryParseClock(item.endTime);
    return from !== null && to !== null && from < to;
  }, 'timeWindow');

export type ScheduleRuleInput = z.infer<typeof scheduleRuleSchema>;
export type ScheduleExceptionInput = z.infer<typeof scheduleExceptionSchema>;

/**
 * Пересечение двух недельных окон одного дня. Используется при добавлении
 * правила: два правила на один день с перекрывающимися часами не запрещены
 * движком (окна объединяются), но бессмыслённы для инструктора — форма
 * предупреждает заранее.
 */
export function windowsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const aFrom = tryParseClock(aStart);
  const aTo = tryParseClock(aEnd);
  const bFrom = tryParseClock(bStart);
  const bTo = tryParseClock(bEnd);
  if (aFrom === null || aTo === null || bFrom === null || bTo === null) return false;
  return aFrom < bTo && bFrom < aTo;
}

/** `YYYY-MM-DD` + `HH:mm` в поясе бизнеса → момент времени. */
export function scheduleInstant(date: string, clock: string): Date | null {
  const [year, month, day] = date.split('-').map(Number);
  const minutesOfDay = tryParseClock(clock);
  if (!year || !month || !day || minutesOfDay === null) return null;
  const parsed = fromZonedParts({ year, month, day, minutesOfDay });
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

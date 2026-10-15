/**
 * RECURRING — правила серий.
 * «Каждый вторник 19:00, N недель» — бизнес-правило, не UI: как генерировать
 * даты серии и сколько максимум держать в одной оплате.
 */

import { booking } from '@/config/business';
import { fromZonedParts, zonedParts } from '@/lib/time/schedule';
import { parseClock } from '@/lib/time/clock';

export interface RecurringPattern {
  weekday: number; // 0 Sun
  startTime: string; // HH:mm в timeZone
  durationMinutes: number;
}

export function nextOccurrences(pattern: RecurringPattern, from: Date, weeks: number, timeZone: string): { startsAt: Date; endsAt: Date }[] {
  if (weeks < booking.recurring.minWeeks || weeks > booking.recurring.maxWeeks) {
    throw Object.assign(new Error('weeks out of range'), { code: 'VALIDATION_FAILED', field: 'weeks' });
  }
  if (!(booking.durationsMinutes as readonly number[]).includes(pattern.durationMinutes)) {
    throw Object.assign(new Error('invalid duration'), { code: 'VALIDATION_FAILED', field: 'durationMinutes' });
  }
  const minutesOfDay = parseClock(pattern.startTime);
  // Находим первое вхождение в поясе timeZone, а не в UTC/local
  let cursor = new Date(from.getTime());
  let first: Date | null = null;
  for (let d = 0; d < 45 && first === null; d += 1) {
    const zp = zonedParts(cursor, timeZone);
    if (zp.weekday !== ((pattern.weekday % 7) + 7) % 7) {
      // Прокручиваем к следующему дню полуночи TZ
      const nextMidnight = fromZonedParts({ year: zp.year, month: zp.month, day: zp.day + 1, minutesOfDay: 0 }, timeZone);
      // Простой day-step: +1 день от полуночи
      cursor = new Date(nextMidnight.getTime());
      // Но чтобы не пропустить день: заново проверим этот новый день на следующей итерации
      // Для простоты инкрементом по zoned-дням
      const adv = zonedParts(cursor, timeZone);
      if (adv.weekday !== ((pattern.weekday % 7) + 7) % 7) continue;
    }
    // День совпал — строим startsAt в TZ
    const zpNow = zonedParts(cursor, timeZone);
    // Если текущий день — целевой weekday, строим событие на этот день minutesOfDay
    if (zpNow.weekday === ((pattern.weekday % 7) + 7) % 7) {
      const cand = fromZonedParts({ year: zpNow.year, month: zpNow.month, day: zpNow.day, minutesOfDay }, timeZone);
      if (cand.getTime() >= from.getTime()) {
        first = cand;
        break;
      }
    }
    // Иначе следующий день
    const nextDay = fromZonedParts({ year: zpNow.year, month: zpNow.month, day: zpNow.day + 1, minutesOfDay: 0 }, timeZone);
    cursor = new Date(nextDay.getTime());
  }
  // Fallback: точная формула через nextOccurrence-логику
  if (!first) {
    const here = zonedParts(from, timeZone);
    const ndWd = ((pattern.weekday % 7) + 7) % 7;
    let daysAhead = (ndWd - here.weekday + 7) % 7;
    if (daysAhead === 0 && minutesOfDay <= here.minutesOfDay) daysAhead = 7;
    const dayAnchor = fromZonedParts({ year: here.year, month: here.month, day: here.day, minutesOfDay: 0 }, timeZone);
    first = new Date(dayAnchor.getTime() + daysAhead * 24 * 60 * 60 * 1000 + minutesOfDay * 60 * 1000);
    // Корректируем через fromZonedParts для точности DST
    const fZp = zonedParts(first, timeZone);
    first = fromZonedParts({ year: fZp.year, month: fZp.month, day: fZp.day, minutesOfDay: fZp.minutesOfDay }, timeZone);
    // Если всё ещё < from, +7
    if (first.getTime() < from.getTime()) first = new Date(first.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  const out: { startsAt: Date; endsAt: Date }[] = [];
  for (let i = 0; i < weeks; i += 1) {
    const base = new Date(first.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    // Пересобираем через zonedParts чтобы неделя в TZ шла по календарю, а не UTC +24h*7
    const zp = zonedParts(base, timeZone);
    const start = fromZonedParts({ year: zp.year, month: zp.month, day: zp.day, minutesOfDay: zp.minutesOfDay }, timeZone);
    const endsAt = new Date(start.getTime() + pattern.durationMinutes * 60 * 1000);
    out.push({ startsAt: start, endsAt });
  }
  return out;
}

export function seriesPrice(baseUnitPrice: number, weeks: number): number {
  // Одна цена занятия * недели; годовая скидка подписки не применяется к серии
  return baseUnitPrice * weeks;
}

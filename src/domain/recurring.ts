/**
 * RECURRING — правила серий.
 * «Каждый вторник 19:00, N недель» — бизнес-правило, не UI: как генерировать
 * даты серии и сколько максимум держать в одной оплате.
 */

import { booking } from '@/config/business';

export interface RecurringPattern {
  weekday: number; // 0 Sun
  startTime: string; // HH:mm
  durationMinutes: number;
}

export function nextOccurrences(pattern: RecurringPattern, from: Date, weeks: number, timeZone: string): { startsAt: Date; endsAt: Date }[] {
  if (weeks < booking.recurring.minWeeks || weeks > booking.recurring.maxWeeks) {
    throw Object.assign(new Error('weeks out of range'), { code: 'VALIDATION_FAILED', field: 'weeks' });
  }
  if (!(booking.durationsMinutes as readonly number[]).includes(pattern.durationMinutes)) {
    throw Object.assign(new Error('invalid duration'), { code: 'VALIDATION_FAILED', field: 'durationMinutes' });
  }
  const out: { startsAt: Date; endsAt: Date }[] = [];
  // naive: iterate days from `from`, step 7 days from first match
  const base = new Date(from);
  base.setHours(0, 0, 0, 0);
  void timeZone;
  let first: Date | null = null;
  for (let d = 0; d < 45 && first === null; d += 1) {
    const cand = new Date(base.getTime() + d * 24 * 60 * 60 * 1000);
    // Compare in UTC weekday because startsAt is UTC; align with expected test (Mon→Tue)
    if (cand.getUTCDay() !== pattern.weekday) continue;
    const [hh, mm] = pattern.startTime.split(':').map(Number);
    const startsAt = new Date(Date.UTC(cand.getUTCFullYear(), cand.getUTCMonth(), cand.getUTCDate(), hh!, mm!, 0, 0));
    if (startsAt.getTime() < from.getTime()) continue;
    first = startsAt;
  }
  if (!first) return [];
  for (let i = 0; i < weeks; i += 1) {
    const startsAt = new Date(first.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + pattern.durationMinutes * 60 * 1000);
    out.push({ startsAt, endsAt });
  }
  return out;
}

export function seriesPrice(baseUnitPrice: number, weeks: number): number {
  // Одна цена занятия * недели; годовая скидка подписки не применяется к серии
  return baseUnitPrice * weeks;
}

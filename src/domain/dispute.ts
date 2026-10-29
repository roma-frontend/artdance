/**
 * DISPUTE (D-08) — споры по броням.
 *
 * Спор открывает участник брони: клиент, инструктор или участник площадки.
 * Решает модератор. Проигравший получает DISPUTE_LOST и −20 к надёжности.
 *
 * Правила здесь, без базы, чтобы их можно было проверить тестом:
 *  - спор открывают по брони, которая отменена или уже прошла по времени;
 *  - проигрывает та сторона, против которой решено.
 */

import type { BookingStatus } from '@/domain/enums';

/** Границы текста спора. Совпадают с подсказкой в форме. */
export const disputeLengths = { min: 12, max: 2000 } as const;

/** Исход: прав заявитель (тот, кто открыл спор) или ответчик (вторая сторона). */
export type DisputeWinner = 'CLAIMANT' | 'RESPONDENT';

export function disputeValidReason(reason: string): boolean {
  const normalized = reason.trim();
  return normalized.length >= disputeLengths.min && normalized.length <= disputeLengths.max;
}

/** Статусы брони, по которым спор уместен. Черновики и брони в ожидании — нет. */
const disputableStatuses: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  'CONFIRMED',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_PROVIDER',
]);

/** У отменённой брони исход уже есть: спорить о нём можно сразу, не дожидаясь даты занятия. */
const cancelledStatuses: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_PROVIDER',
]);

export interface DisputeBookingFacts {
  status: BookingStatus;
  endsAt: Date;
}

/**
 * Можно ли открыть спор по брони в момент `now`.
 *
 * Не отменённое занятие оспаривают только после окончания: иначе спор откроют до урока,
 * который ещё может пройти как задумано.
 */
export function disputeOpenable(booking: DisputeBookingFacts, now: Date): boolean {
  if (!disputableStatuses.has(booking.status)) return false;
  if (cancelledStatuses.has(booking.status)) return true;
  return booking.endsAt.getTime() <= now.getTime();
}

/** Стороны брони, нужные для выбора ответчика и проигравшего. */
export interface DisputeSides {
  customerId: string;
  /** Пользователь инструктора; `null`, если бронь без инструктора. */
  instructorUserId: string | null;
}

/**
 * Ответчик: вторая сторона относительно открывшего спор.
 * Открыл клиент — ответчик инструктор; иначе ответчик клиент.
 */
export function disputeRespondentId(sides: DisputeSides, openedBy: string): string | null {
  return openedBy === sides.customerId ? sides.instructorUserId : sides.customerId;
}

/**
 * Проигравший, которому начисляется DISPUTE_LOST.
 * Прав заявитель — проигрывает ответчик. Прав ответчик — проигрывает заявитель.
 * `null` — ответчика-пользователя нет (бронь без инструктора), штраф не начисляется.
 */
export function disputeLoserId(winner: DisputeWinner, sides: DisputeSides, openedBy: string): string | null {
  return winner === 'CLAIMANT' ? disputeRespondentId(sides, openedBy) : openedBy;
}

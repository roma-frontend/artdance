/**
 * ЗАЯВКА НА БРОНЬ (D-04): чистые правила — нужен ли ответ инструктора и когда.
 *
 * Без БД и без чтения часов: время и данные приходят аргументами,
 * поэтому каждое правило проверяется отдельным тестом.
 */

import type { BookingStatus, BookingSubject } from '@/generated/prisma/client';

const HOUR_MS = 60 * 60 * 1000;

/** Тип брони требует ответа инструктора, если его правило включено в конфиге. */
export function needsResponse(subject: BookingSubject, rules: Partial<Record<BookingSubject, true>>): boolean {
  return rules[subject] === true;
}

/**
 * Срок ответа: `autoDeclineAfterHours` от создания, но не позже начала занятия.
 * Иначе заявку можно принять уже после того, как урок начался.
 */
export function requestExpiresAtFor(createdAt: Date, autoDeclineAfterHours: number, startsAt: Date): Date {
  const byAge = createdAt.getTime() + autoDeclineAfterHours * HOUR_MS;
  return new Date(Math.min(byAge, startsAt.getTime()));
}

/**
 * Момент напоминания инструктору: SLA ответа от создания.
 * Если SLA уже не успевает до срока (заявка на скорую дату), напоминаем сразу:
 * иначе такая заявка молча истекает без единого напоминания.
 */
export function requestDueAtFor(createdAt: Date, slaHours: number, requestExpiresAt: Date): Date {
  const slaPoint = createdAt.getTime() + slaHours * HOUR_MS;
  return new Date(slaPoint < requestExpiresAt.getTime() ? slaPoint : createdAt.getTime());
}

/** Ключ дедупликации напоминания: одно напоминание на заявку. */
export function requestDueDedupeKey(bookingId: string): string {
  return `booking:${bookingId}:request-due`;
}

export type RequestCronAction = 'EXPIRE' | 'REMIND' | 'NONE';

export interface RequestCronInput {
  status: BookingStatus;
  requestExpiresAt: Date | null;
  createdAt: Date;
  slaHours: number;
  now: Date;
}

/**
 * Что делать с заявкой в прогоне cron:
 * - не PENDING или без срока — не открытая заявка → NONE;
 * - срок наступил (ровно в момент срока уже истёк) → EXPIRE;
 * - пора напомнить инструктору → REMIND (повтор письма гасит сервис, не эта функция);
 * - иначе → NONE.
 */
export function requestCronAction(input: RequestCronInput): RequestCronAction {
  const { status, requestExpiresAt, createdAt, slaHours, now } = input;
  if (status !== 'PENDING' || requestExpiresAt === null) return 'NONE';
  if (now.getTime() >= requestExpiresAt.getTime()) return 'EXPIRE';
  if (now.getTime() >= requestDueAtFor(createdAt, slaHours, requestExpiresAt).getTime()) return 'REMIND';
  return 'NONE';
}

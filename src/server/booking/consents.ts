/**
 * Согласия при брони (D-03). Правила задаются в `config/consents.ts`. Пока правил нет,
 * бронь не читает базу и не меняется.
 */

import 'server-only';

import { adultAgeYears } from '@/config/legal';
import { bookingConsentRules, bookingConsents, bookingConsentsRequired, type BookingConsentId } from '@/config/consents';
import { site } from '@/config/site';
import { completedYears } from '@/domain/age';
import { domainErrors } from '@/domain/errors';
import { hasConsent, recordConsent } from '@/lib/consent/store';
import { db } from '@/lib/db';
import type { BookingSubject } from '@/generated/prisma/client';

export interface AcceptedBookingConsent {
  userId: string;
  email: string;
  documentId: string;
  version: string;
}

export interface BookingConsentCheck {
  /** Пишется в `Booking.consentVersion`: `documentId:version` через запятую; null, если согласий не требовалось. */
  consentVersion: string | null;
  /** Согласия, принятые в этой брони. Сохраняются после создания брони. */
  accepted: readonly AcceptedBookingConsent[];
}

/** Вход проверки: кто бронирует, на какой предмет, что отмечено и дата рождения участника. */
export interface CheckBookingConsentsInput {
  customerId: string;
  subject: BookingSubject;
  accepted?: readonly BookingConsentId[];
  /** Дата рождения участника, `YYYY-MM-DD`. Нужна, только если у предмета есть правило. */
  participantBirthDate?: string | null;
  /** Момент брони: от него считается возраст участника. */
  now: Date;
}

/**
 * Проверяет согласия, которые требует предмет брони. Обычное согласие засчитывается, если его
 * приняли в этой брони или раньше. Родительское — только принятое в этой брони. Возраст участника
 * считается на `now` по поясу площадки. Нет даты или она не распознана — отказ, а не угадывание.
 */
export async function checkBookingConsents(input: CheckBookingConsentsInput): Promise<BookingConsentCheck> {
  if (!bookingConsentRules[input.subject]?.length) return { consentVersion: null, accepted: [] };

  const age = input.participantBirthDate ? completedYears(input.participantBirthDate, input.now, site.timeZone) : null;
  if (age === null) throw domainErrors.participantBirthDateInvalid();
  const required = bookingConsentsRequired(input.subject, age < adultAgeYears);

  const user = await db.user.findUnique({ where: { id: input.customerId }, select: { email: true } });
  if (!user) throw domainErrors.unauthorized();

  const given = new Set<BookingConsentId>(input.accepted ?? []);
  const accepted: AcceptedBookingConsent[] = [];
  const versions: string[] = [];
  for (const id of required) {
    const { documentId, version, reusable } = bookingConsents[id];
    if (given.has(id)) {
      accepted.push({ userId: input.customerId, email: user.email, documentId, version });
    } else if (!reusable || !(await hasConsent(user.email, documentId, version))) {
      throw domainErrors.consentRequired();
    }
    versions.push(`${documentId}:${version}`);
  }
  return { consentVersion: versions.join(','), accepted };
}

/**
 * Сохраняет согласия, принятые в брони. Бронь уже создана, поэтому сбой записи
 * только логируется: ошибка после создания брони была бы хуже.
 */
export async function storeBookingConsents(check: BookingConsentCheck, ipAddress: string | null): Promise<void> {
  for (const item of check.accepted) {
    try {
      await recordConsent({ ...item, ipAddress });
    } catch (error) {
      console.error('[booking] согласие не сохранено', error);
    }
  }
}

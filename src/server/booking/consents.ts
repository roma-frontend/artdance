/**
 * Согласия при брони (D-03). Правила задаются в `config/consents.ts`. Пока правил нет,
 * бронь не читает базу и не меняется.
 */

import 'server-only';

import { bookingConsentRules, bookingConsents, type BookingConsentId } from '@/config/consents';
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

/**
 * Проверяет согласия, которые требует предмет брони. Согласие засчитывается, если его
 * приняли в этой брони или раньше. Иначе — VALIDATION_FAILED по полю `consents`.
 */
export async function checkBookingConsents(input: {
  customerId: string;
  subject: BookingSubject;
  accepted?: readonly BookingConsentId[];
}): Promise<BookingConsentCheck> {
  const required = bookingConsentRules[input.subject] ?? [];
  if (required.length === 0) return { consentVersion: null, accepted: [] };

  const user = await db.user.findUnique({ where: { id: input.customerId }, select: { email: true } });
  if (!user) throw domainErrors.unauthorized();

  const given = new Set<BookingConsentId>(input.accepted ?? []);
  const accepted: AcceptedBookingConsent[] = [];
  const versions: string[] = [];
  for (const id of required) {
    const { documentId, version } = bookingConsents[id];
    if (given.has(id)) {
      accepted.push({ userId: input.customerId, email: user.email, documentId, version });
    } else if (!(await hasConsent(user.email, documentId, version))) {
      throw domainErrors.validationFailed('consents');
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

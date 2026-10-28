/**
 * Согласия при брони (D-03). Тексты пишет юрист (блокер 0.8): версия `draft-1`
 * значит, что текст ещё не утверждён.
 *
 * Правил пока нет: ни один предмет брони не требует согласия, поэтому проверка не
 * читает базу и не меняет поведение. Включение = правило ниже вместе с галочками
 * в web и mobile. Без галочек включать правило нельзя: бронь станет недоступна.
 */

import type { BookingSubject } from '@/generated/prisma/client';

export const bookingConsentIds = ['healthWaiver', 'shootingConsent', 'minorParentalConsent'] as const;

export type BookingConsentId = (typeof bookingConsentIds)[number];

/** Документ для `ConsentRecord`: `documentId` и `version`. */
export const bookingConsents: Record<BookingConsentId, { documentId: string; version: string }> = {
  healthWaiver: { documentId: 'healthWaiver', version: 'draft-1' },
  shootingConsent: { documentId: 'shootingConsent', version: 'draft-1' },
  minorParentalConsent: { documentId: 'minorParentalConsent', version: 'draft-1' },
};

/** Какие согласия требует бронь предмета. Пусто: ничего не требуется. */
export const bookingConsentRules: Partial<Record<BookingSubject, readonly BookingConsentId[]>> = {};

/**
 * Согласия при брони (D-03). Тексты пишет юрист (блокер 0.8): версия `draft-1`
 * значит, что текст ещё не утверждён.
 *
 * Правил пока нет: ни один предмет брони не требует согласия, поэтому проверка не
 * читает базу и не меняет поведение. Включение = правило ниже вместе с галочками
 * в web и mobile. Без галочек включать правило нельзя: бронь станет недоступна.
 */

import type { BookingSubject } from '@/generated/prisma/client';
import type { MessageKey } from '@/i18n/types';

import { adultAgeYears } from './legal';

export const bookingConsentIds = ['healthWaiver', 'shootingConsent', 'minorParentalConsent'] as const;

export type BookingConsentId = (typeof bookingConsentIds)[number];

export interface BookingConsentSpec {
  /** Документ для `ConsentRecord`. */
  documentId: string;
  /** Редакция текста: меняется вместе с текстом, по ней фиксируется согласие. */
  version: string;
  /** `draft`: текст ждёт проверки юристом и показывается с пометкой. */
  status: 'draft' | 'active';
  /**
   * Засчитывается ли согласие, принятое раньше. Родительское относится к конкретному
   * участнику, поэтому спрашивается при каждой брони.
   */
  reusable: boolean;
}

export const bookingConsents: Record<BookingConsentId, BookingConsentSpec> = {
  healthWaiver: { documentId: 'healthWaiver', version: 'draft-1', status: 'draft', reusable: true },
  shootingConsent: { documentId: 'shootingConsent', version: 'draft-1', status: 'draft', reusable: true },
  minorParentalConsent: { documentId: 'minorParentalConsent', version: 'draft-1', status: 'draft', reusable: false },
};

/** Какие согласия требует бронь предмета. Пусто: ничего не требуется. */
export const bookingConsentRules: Partial<Record<BookingSubject, readonly BookingConsentId[]>> = {};

/**
 * Дополнительные согласия для участника младше `adultAgeYears` (legal.ts). Действуют
 * только для предмета, у которого есть правило: без правила возраст не проверяется.
 */
export const bookingMinorConsentIds: readonly BookingConsentId[] = ['minorParentalConsent'];

/** Нужна ли дата рождения участника. Да, если у предмета есть правило: без неё возраст не проверить. */
export function bookingConsentRequiresBirthDate(subject: BookingSubject): boolean {
  return (bookingConsentRules[subject]?.length ?? 0) > 0;
}

/** Согласия, которые требует бронь предмета для участника данного возраста. Пусто, если правила нет. */
export function bookingConsentsRequired(subject: BookingSubject, isMinor: boolean): readonly BookingConsentId[] {
  const base = bookingConsentRules[subject] ?? [];
  if (base.length === 0) return [];
  return isMinor ? [...new Set([...base, ...bookingMinorConsentIds])] : [...base];
}

/** Ключ текста согласия для галочки. */
export function bookingConsentTextKey(id: BookingConsentId): MessageKey {
  return `booking.consent.items.${id}` as MessageKey;
}

/** Снимок правил для клиента без доступа к конфигу (mobile). */
export function bookingConsentsSnapshot() {
  return {
    adultAgeYears,
    minorConsents: bookingMinorConsentIds,
    subjects: bookingConsentRules,
    draft: bookingConsentIds.filter((id) => bookingConsents[id].status === 'draft'),
  };
}

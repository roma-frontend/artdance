/**
 * ФОРМА СОГЛАСИЙ ПРИ БРОНИ (D-03) — общая для экранов веба.
 *
 * Решает, что показать участнику, что уже отмечено и можно ли отправить бронь.
 * Сервер проверяет всё заново и остаётся источником истины: здесь только то, что
 * нужно интерфейсу. Пока правил нет (`bookingConsentRules` пуст), форма неактивна,
 * поля не появляются, тело запроса не меняется.
 */

import type { BookingSubject } from '@/generated/prisma/client';
import { adultAgeYears, bookingConsentRequiresBirthDate, bookingConsents, bookingConsentsRequired, type BookingConsentId } from '@/config';
import { completedYears } from '@/domain/age';

/** Поля, которые сервер может отвергнуть из-за согласий (см. `checkBookingConsents`). */
export type BookingConsentField = 'consents' | 'participantBirthDate';

export interface BookingConsentFormInput {
  subject: BookingSubject;
  /** `YYYY-MM-DD` или пустая строка, пока дата не введена. */
  birthDate: string;
  /** Отмеченные галочки; лишние id игнорируются. */
  checked: readonly BookingConsentId[];
  now: Date;
  timeZone: string;
}

export interface BookingConsentForm {
  /** У предмета есть правило: нужны дата рождения и согласия. */
  active: boolean;
  /** Полных лет участнику; null — дата не введена или некорректна. */
  age: number | null;
  /** Дата введена, но не проходит проверку (несуществующая, в будущем, старше 120 лет). */
  birthDateInvalid: boolean;
  /** Согласия, которые спрашиваются у этого участника. */
  ids: readonly BookingConsentId[];
  /** Отмеченные согласия из `ids`, в порядке `ids`. */
  acceptedIds: readonly BookingConsentId[];
  /** Хотя бы один из текстов ещё черновик. */
  draft: boolean;
  /** Бронь можно отправить: правила нет, либо возраст известен и отмечено всё нужное. */
  ready: boolean;
}

export function bookingConsentForm({ subject, birthDate, checked, now, timeZone }: BookingConsentFormInput): BookingConsentForm {
  if (!bookingConsentRequiresBirthDate(subject)) {
    return { active: false, age: null, birthDateInvalid: false, ids: [], acceptedIds: [], draft: false, ready: true };
  }
  const age = completedYears(birthDate, now, timeZone);
  const ids = age === null ? [] : bookingConsentsRequired(subject, age < adultAgeYears);
  const acceptedIds = ids.filter((id) => checked.includes(id));
  return {
    active: true,
    age,
    birthDateInvalid: birthDate !== '' && age === null,
    ids,
    acceptedIds,
    draft: ids.some((id) => bookingConsents[id].status === 'draft'),
    ready: age !== null && ids.length > 0 && acceptedIds.length === ids.length,
  };
}

/** Поля тела запроса брони: пусто, пока правила нет; иначе отмеченные согласия и дата рождения. */
export function consentRequestFields(
  form: BookingConsentForm,
  birthDate: string,
): { consents?: BookingConsentId[]; participantBirthDate?: string } {
  return form.active ? { consents: [...form.acceptedIds], participantBirthDate: birthDate } : {};
}

/** Поле, которое сервер отверг из-за согласий; null — ошибка не про согласия. */
export function bookingConsentErrorField(field: string | null | undefined): BookingConsentField | null {
  return field === 'consents' || field === 'participantBirthDate' ? field : null;
}

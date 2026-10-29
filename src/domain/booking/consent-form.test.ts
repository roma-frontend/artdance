import { afterEach, describe, expect, it } from 'vitest';

import type { BookingSubject } from '@/generated/prisma/client';
import { adultAgeYears, bookingConsentRules, bookingConsents, type BookingConsentId } from '@/config';

import { bookingConsentErrorField, bookingConsentForm, consentRequestFields } from './consent-form';

const TZ = 'Asia/Yerevan';
const NOW = new Date('2026-09-01T12:00:00+04:00');
const ADULT = '1990-05-01';
const MINOR = '2015-05-01';

afterEach(() => {
  delete bookingConsentRules.PRIVATE_SESSION;
  delete bookingConsentRules.STUDIO_RENTAL;
});

function formFor(birthDate: string, checked: readonly BookingConsentId[] = [], subject: BookingSubject = 'PRIVATE_SESSION') {
  return bookingConsentForm({ subject, birthDate, checked, now: NOW, timeZone: TZ });
}

describe('bookingConsentForm', () => {
  it('неактивна, пока у предмета нет правила: ничего не требует и готова', () => {
    expect(formFor('')).toMatchObject({ active: false, ids: [], acceptedIds: [], draft: false, ready: true });
    expect(formFor(MINOR)).toMatchObject({ active: false, ready: true });
  });

  it('взрослому нужны только базовые согласия', () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    expect(formFor(ADULT)).toMatchObject({ active: true, age: 36, ids: ['healthWaiver'], ready: false });
    expect(formFor(ADULT, ['healthWaiver'])).toMatchObject({ ready: true, acceptedIds: ['healthWaiver'] });
  });

  it('несовершеннолетнему добавляется родительское согласие, готовность — только при всех галочках', () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    expect(formFor(MINOR, ['healthWaiver']).ids).toEqual(['healthWaiver', 'minorParentalConsent']);
    expect(formFor(MINOR, ['healthWaiver']).ready).toBe(false);
    expect(formFor(MINOR, ['healthWaiver', 'minorParentalConsent']).ready).toBe(true);
  });

  it('граница возраста: в день восемнадцатилетия участник взрослый, днём раньше — нет', () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    const birthYear = 2026 - adultAgeYears;
    expect(formFor(`${birthYear}-09-01`).ids).toEqual(['healthWaiver']);
    expect(formFor(`${birthYear}-09-02`).ids).toEqual(['healthWaiver', 'minorParentalConsent']);
  });

  it('без даты рождения ничего не спрашивает и не готова; ошибки ввода ещё нет', () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    expect(formFor('')).toMatchObject({ active: true, age: null, birthDateInvalid: false, ids: [], ready: false });
  });

  it('некорректная дата: несуществующий день, будущее или не YYYY-MM-DD — ошибка ввода', () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    for (const birthDate of ['1990-02-30', '2030-01-01', '90-01-01']) {
      expect(formFor(birthDate), birthDate).toMatchObject({ active: true, age: null, birthDateInvalid: true, ready: false });
    }
  });

  it('галочки, которых нет у участника, не засчитываются', () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    expect(formFor(ADULT, ['shootingConsent'])).toMatchObject({ acceptedIds: [], ready: false });
  });

  it('правило одного предмета не влияет на другой', () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    expect(formFor(ADULT, [], 'PRIVATE_SESSION').active).toBe(true);
    expect(formFor(ADULT, [], 'STUDIO_RENTAL').active).toBe(false);
  });

  it('черновик отмечается по статусу текстов, которые спрашиваются', () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    expect(formFor(ADULT).draft).toBe(bookingConsents.healthWaiver.status === 'draft');
  });
});

describe('consentRequestFields', () => {
  it('пусто, пока правила нет: тело запроса не меняется', () => {
    expect(consentRequestFields(formFor(ADULT), ADULT)).toEqual({});
  });

  it('при правиле передаёт отмеченные согласия и дату рождения', () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    const form = formFor(ADULT, ['healthWaiver']);
    expect(consentRequestFields(form, ADULT)).toEqual({ consents: ['healthWaiver'], participantBirthDate: ADULT });
  });
});

describe('bookingConsentErrorField', () => {
  it('узнаёт поля согласий в ответе сервера и игнорирует остальные', () => {
    expect(bookingConsentErrorField('consents')).toBe('consents');
    expect(bookingConsentErrorField('participantBirthDate')).toBe('participantBirthDate');
    expect(bookingConsentErrorField('holdId')).toBeNull();
    expect(bookingConsentErrorField(undefined)).toBeNull();
  });
});

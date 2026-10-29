import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  birthDateToAge,
  bookingConsentForm,
  bookingSubjectFor,
  buildConsentBody,
  consentErrorField,
  type BookingConsentRules,
} from './booking-consents.ts';

const TODAY = '2026-05-10';
const ADULT = '1990-05-10'; // 36 лет на TODAY
const MINOR = '2015-06-01'; // 10 лет на TODAY

const RULES: BookingConsentRules = {
  adultAgeYears: 18,
  minorConsents: ['minorParentalConsent'],
  subjects: { CLASS_SESSION: ['healthWaiver', 'shootingConsent'] },
  draft: ['healthWaiver', 'shootingConsent', 'minorParentalConsent'],
};

test('birthDateToAge counts completed years on the given day', () => {
  assert.equal(birthDateToAge('2000-05-10', '2026-05-09'), 25);
  assert.equal(birthDateToAge('2000-05-10', '2026-05-10'), 26);
  assert.equal(birthDateToAge(ADULT, TODAY), 36);
});

test('birthDateToAge handles a leap-day birthday', () => {
  assert.equal(birthDateToAge('2000-02-29', '2026-02-28'), 25);
  assert.equal(birthDateToAge('2000-02-29', '2026-03-01'), 26);
});

test('birthDateToAge rejects empty, malformed and impossible dates', () => {
  assert.equal(birthDateToAge('', TODAY), null);
  assert.equal(birthDateToAge('10.05.1990', TODAY), null);
  assert.equal(birthDateToAge('1990-5-10', TODAY), null);
  assert.equal(birthDateToAge('1990-02-30', TODAY), null);
});

test('birthDateToAge rejects future dates and ages above 120', () => {
  assert.equal(birthDateToAge('2026-05-11', TODAY), null);
  assert.equal(birthDateToAge('1906-05-10', TODAY), 120);
  assert.equal(birthDateToAge('1905-05-10', TODAY), null);
});

test('bookingConsentForm is inactive without rules or without a rule for the subject', () => {
  const noRules = bookingConsentForm({ rules: null, subject: 'CLASS_SESSION', birthDate: '', checked: [], today: TODAY });
  assert.equal(noRules.active, false);
  assert.equal(noRules.ready, true);
  assert.deepEqual(buildConsentBody(noRules, ''), {});

  const noSubjectRule = bookingConsentForm({ rules: RULES, subject: 'PRIVATE_SESSION', birthDate: '', checked: [], today: TODAY });
  assert.equal(noSubjectRule.active, false);
  assert.equal(noSubjectRule.ready, true);
  assert.deepEqual(buildConsentBody(noSubjectRule, ''), {});
});

test('an active rule is not ready until a valid birth date is given', () => {
  const form = bookingConsentForm({
    rules: RULES,
    subject: 'CLASS_SESSION',
    birthDate: '',
    checked: ['healthWaiver', 'shootingConsent'],
    today: TODAY,
  });
  assert.equal(form.active, true);
  assert.equal(form.age, null);
  assert.deepEqual(form.ids, []);
  assert.equal(form.ready, false);
  assert.equal(form.birthDateInvalid, false);
});

test('a complete but impossible date is flagged, a partial one is not', () => {
  const partial = bookingConsentForm({ rules: RULES, subject: 'CLASS_SESSION', birthDate: '1990-0', checked: [], today: TODAY });
  assert.equal(partial.birthDateInvalid, false);
  const impossible = bookingConsentForm({ rules: RULES, subject: 'CLASS_SESSION', birthDate: '1990-02-30', checked: [], today: TODAY });
  assert.equal(impossible.birthDateInvalid, true);
});

test('an adult must tick every base consent before the form is ready', () => {
  const partial = bookingConsentForm({ rules: RULES, subject: 'CLASS_SESSION', birthDate: ADULT, checked: ['healthWaiver'], today: TODAY });
  assert.deepEqual(partial.ids, ['healthWaiver', 'shootingConsent']);
  assert.equal(partial.ready, false);

  const full = bookingConsentForm({
    rules: RULES,
    subject: 'CLASS_SESSION',
    birthDate: ADULT,
    checked: ['shootingConsent', 'healthWaiver'],
    today: TODAY,
  });
  assert.deepEqual(full.acceptedIds, ['healthWaiver', 'shootingConsent']);
  assert.equal(full.ready, true);
});

test('a minor also needs the parental consent', () => {
  const baseTicked = bookingConsentForm({
    rules: RULES,
    subject: 'CLASS_SESSION',
    birthDate: MINOR,
    checked: ['healthWaiver', 'shootingConsent'],
    today: TODAY,
  });
  assert.equal(baseTicked.age, 10);
  assert.deepEqual(baseTicked.ids, ['healthWaiver', 'shootingConsent', 'minorParentalConsent']);
  assert.equal(baseTicked.ready, false);

  const allTicked = bookingConsentForm({
    rules: RULES,
    subject: 'CLASS_SESSION',
    birthDate: MINOR,
    checked: ['healthWaiver', 'shootingConsent', 'minorParentalConsent'],
    today: TODAY,
  });
  assert.equal(allTicked.ready, true);
});

test('the draft flag follows the draft list of the rules', () => {
  const draft = bookingConsentForm({ rules: RULES, subject: 'CLASS_SESSION', birthDate: ADULT, checked: [], today: TODAY });
  assert.equal(draft.draft, true);
  const final = bookingConsentForm({
    rules: { ...RULES, draft: [] },
    subject: 'CLASS_SESSION',
    birthDate: ADULT,
    checked: [],
    today: TODAY,
  });
  assert.equal(final.draft, false);
});

test('buildConsentBody sends the accepted consents and the birth date only when active', () => {
  const form = bookingConsentForm({
    rules: RULES,
    subject: 'CLASS_SESSION',
    birthDate: ADULT,
    checked: ['healthWaiver', 'shootingConsent'],
    today: TODAY,
  });
  assert.deepEqual(buildConsentBody(form, ADULT), { consents: ['healthWaiver', 'shootingConsent'], participantBirthDate: ADULT });
});

test('bookingSubjectFor follows the server rule for group, pair and private slots', () => {
  assert.equal(bookingSubjectFor({}, null), 'PRIVATE_SESSION');
  assert.equal(bookingSubjectFor({ sessionId: 'session-1' }, 'GROUP'), 'CLASS_SESSION');
  assert.equal(bookingSubjectFor({ sessionId: 'session-1' }, 'PAIR'), 'CLASS_SESSION');
  assert.equal(bookingSubjectFor({ sessionId: 'session-1' }, 'PRIVATE'), 'PRIVATE_SESSION');
  assert.equal(bookingSubjectFor({ sessionId: 'session-1' }, null), 'CLASS_SESSION');
});

test('consentErrorField keeps only the two fields the booking form can highlight', () => {
  assert.equal(consentErrorField('consents'), 'consents');
  assert.equal(consentErrorField('participantBirthDate'), 'participantBirthDate');
  assert.equal(consentErrorField('holdId'), null);
  assert.equal(consentErrorField(undefined), null);
  assert.equal(consentErrorField(null), null);
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { user: { findUnique: vi.fn() } },
  hasConsent: vi.fn(),
  recordConsent: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/lib/consent/store', () => ({
  hasConsent: mocks.hasConsent,
  recordConsent: mocks.recordConsent,
}));

import { bookingConsentRules } from '@/config/consents';
import { checkBookingConsents, storeBookingConsents } from './consents';

const NOW = new Date('2026-09-01T12:00:00+04:00');
const ADULT_BIRTH_DATE = '1990-05-01';
const MINOR_BIRTH_DATE = '2015-05-01';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.user.findUnique.mockResolvedValue({ email: 'anna@example.com' });
});

afterEach(() => {
  delete bookingConsentRules.PRIVATE_SESSION;
});

describe('checkBookingConsents', () => {
  it('без правила не читает базу и ничего не требует', async () => {
    await expect(checkBookingConsents({ customerId: 'customer-1', subject: 'PRIVATE_SESSION', now: NOW }))
      .resolves.toEqual({ consentVersion: null, accepted: [] });
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
    expect(mocks.hasConsent).not.toHaveBeenCalled();
  });

  it('согласие, принятое в этой брони, попадает в версию и в список для записи', async () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver', 'shootingConsent'];

    const result = await checkBookingConsents({
      customerId: 'customer-1',
      subject: 'PRIVATE_SESSION',
      accepted: ['healthWaiver', 'shootingConsent'],
      participantBirthDate: ADULT_BIRTH_DATE,
      now: NOW,
    });

    expect(result.consentVersion).toBe('healthWaiver:draft-1,shootingConsent:draft-1');
    expect(result.accepted).toEqual([
      { userId: 'customer-1', email: 'anna@example.com', documentId: 'healthWaiver', version: 'draft-1' },
      { userId: 'customer-1', email: 'anna@example.com', documentId: 'shootingConsent', version: 'draft-1' },
    ]);
    expect(mocks.hasConsent).not.toHaveBeenCalled();
  });

  it('согласие, принятое раньше, засчитывается без нового принятия', async () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    mocks.hasConsent.mockResolvedValue(true);

    await expect(checkBookingConsents({ customerId: 'customer-1', subject: 'PRIVATE_SESSION', participantBirthDate: ADULT_BIRTH_DATE, now: NOW }))
      .resolves.toEqual({ consentVersion: 'healthWaiver:draft-1', accepted: [] });
    expect(mocks.hasConsent).toHaveBeenCalledWith('anna@example.com', 'healthWaiver', 'draft-1');
  });

  it('нет ни принятия, ни записи: VALIDATION_FAILED по полю consents', async () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    mocks.hasConsent.mockResolvedValue(false);

    const error = await checkBookingConsents({ customerId: 'customer-1', subject: 'PRIVATE_SESSION', participantBirthDate: ADULT_BIRTH_DATE, now: NOW })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'VALIDATION_FAILED', field: 'consents' });
  });

  it('неизвестный пользователь получает UNAUTHORIZED', async () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    mocks.db.user.findUnique.mockResolvedValue(null);

    const error = await checkBookingConsents({ customerId: 'ghost', subject: 'PRIVATE_SESSION', participantBirthDate: ADULT_BIRTH_DATE, now: NOW })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('при активном правиле без даты рождения отказ по полю participantBirthDate, база не читается', async () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    mocks.hasConsent.mockResolvedValue(true);

    const error = await checkBookingConsents({ customerId: 'customer-1', subject: 'PRIVATE_SESSION', now: NOW })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'VALIDATION_FAILED', field: 'participantBirthDate' });
    expect(mocks.db.user.findUnique).not.toHaveBeenCalled();
  });

  it('дата в будущем или несуществующая не угадывается, даже при готовом согласии', async () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    mocks.hasConsent.mockResolvedValue(true);

    for (const participantBirthDate of ['2099-01-01', '1990-02-30']) {
      const error = await checkBookingConsents({ customerId: 'customer-1', subject: 'PRIVATE_SESSION', participantBirthDate, now: NOW })
        .catch((e: unknown) => e);
      expect(error).toMatchObject({ code: 'VALIDATION_FAILED', field: 'participantBirthDate' });
    }
  });

  it('участник младше 18 без родительского согласия в этой брони не проходит, даже с прежним', async () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    mocks.hasConsent.mockResolvedValue(true);

    const error = await checkBookingConsents({
      customerId: 'customer-1',
      subject: 'PRIVATE_SESSION',
      accepted: ['healthWaiver'],
      participantBirthDate: MINOR_BIRTH_DATE,
      now: NOW,
    }).catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'VALIDATION_FAILED', field: 'consents' });
    expect(mocks.hasConsent).not.toHaveBeenCalledWith('anna@example.com', 'minorParentalConsent', 'draft-1');
  });

  it('участник младше 18 с обоими согласиями: родительское попадает в версию и в записи', async () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];

    const result = await checkBookingConsents({
      customerId: 'customer-1',
      subject: 'PRIVATE_SESSION',
      accepted: ['healthWaiver', 'minorParentalConsent'],
      participantBirthDate: MINOR_BIRTH_DATE,
      now: NOW,
    });

    expect(result.consentVersion).toBe('healthWaiver:draft-1,minorParentalConsent:draft-1');
    expect(result.accepted.map((item) => item.documentId)).toEqual(['healthWaiver', 'minorParentalConsent']);
  });

  it('взрослому родительское не требуется и не записывается, даже если галочка стоит', async () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];

    const result = await checkBookingConsents({
      customerId: 'customer-1',
      subject: 'PRIVATE_SESSION',
      accepted: ['healthWaiver', 'minorParentalConsent'],
      participantBirthDate: ADULT_BIRTH_DATE,
      now: NOW,
    });

    expect(result.consentVersion).toBe('healthWaiver:draft-1');
    expect(result.accepted.map((item) => item.documentId)).toEqual(['healthWaiver']);
  });
});

describe('storeBookingConsents', () => {
  const accepted = [{ userId: 'customer-1', email: 'anna@example.com', documentId: 'healthWaiver', version: 'draft-1' }];

  it('пишет каждое принятое согласие с IP брони', async () => {
    mocks.recordConsent.mockResolvedValue(undefined);

    await storeBookingConsents({ consentVersion: 'healthWaiver:draft-1', accepted }, '203.0.113.7');

    expect(mocks.recordConsent).toHaveBeenCalledWith({ ...accepted[0], ipAddress: '203.0.113.7' });
  });

  it('сбой записи не выходит наружу: бронь уже создана', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.recordConsent.mockRejectedValue(new Error('db down'));

    await expect(storeBookingConsents({ consentVersion: 'healthWaiver:draft-1', accepted }, null))
      .resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('без принятых согласий ничего не пишет', async () => {
    await storeBookingConsents({ consentVersion: null, accepted: [] }, null);

    expect(mocks.recordConsent).not.toHaveBeenCalled();
  });
});

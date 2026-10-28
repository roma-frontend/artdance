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

beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.user.findUnique.mockResolvedValue({ email: 'anna@example.com' });
});

afterEach(() => {
  delete bookingConsentRules.PRIVATE_SESSION;
});

describe('checkBookingConsents', () => {
  it('без правила не читает базу и ничего не требует', async () => {
    await expect(checkBookingConsents({ customerId: 'customer-1', subject: 'PRIVATE_SESSION' }))
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

    await expect(checkBookingConsents({ customerId: 'customer-1', subject: 'PRIVATE_SESSION' }))
      .resolves.toEqual({ consentVersion: 'healthWaiver:draft-1', accepted: [] });
    expect(mocks.hasConsent).toHaveBeenCalledWith('anna@example.com', 'healthWaiver', 'draft-1');
  });

  it('нет ни принятия, ни записи: VALIDATION_FAILED по полю consents', async () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    mocks.hasConsent.mockResolvedValue(false);

    const error = await checkBookingConsents({ customerId: 'customer-1', subject: 'PRIVATE_SESSION' })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'VALIDATION_FAILED', field: 'consents' });
  });

  it('неизвестный пользователь получает UNAUTHORIZED', async () => {
    bookingConsentRules.PRIVATE_SESSION = ['healthWaiver'];
    mocks.db.user.findUnique.mockResolvedValue(null);

    const error = await checkBookingConsents({ customerId: 'ghost', subject: 'PRIVATE_SESSION' })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'UNAUTHORIZED' });
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

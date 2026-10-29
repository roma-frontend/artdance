import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { reviewQueueEntry: { upsert: vi.fn() } },
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));

import { BOOKING_CONTACT_REVIEW_KIND, flagBookingContactText } from './guardrails';

describe('очередь проверки контактов в брони', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('создаёт одну запись на бронь, а в причине нет значений контактов', async () => {
    mocks.db.reviewQueueEntry.upsert.mockResolvedValue({});

    await flagBookingContactText({ bookingId: 'booking-1', fields: ['customerAddress'], kinds: ['phone'] });

    expect(mocks.db.reviewQueueEntry.upsert).toHaveBeenCalledWith({
      where: { kind_subject: { kind: BOOKING_CONTACT_REVIEW_KIND, subject: 'booking:booking-1' } },
      update: {},
      create: {
        kind: BOOKING_CONTACT_REVIEW_KIND,
        subject: 'booking:booking-1',
        reason: 'contact-text fields=customerAddress kinds=phone',
      },
    });
  });

  it('сбой записи не пробрасывается, потому что бронь уже создана', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.db.reviewQueueEntry.upsert.mockRejectedValue(new Error('db down'));

    await expect(
      flagBookingContactText({ bookingId: 'booking-1', fields: ['partnerName'], kinds: ['handle'] }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

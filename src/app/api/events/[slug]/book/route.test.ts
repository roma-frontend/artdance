import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCaller: vi.fn(),
  checkRateLimit: vi.fn(),
  createEventBooking: vi.fn(),
  assertEntitlementOrThrow: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock('@/lib/auth/guards', () => ({ getCaller: mocks.getCaller }));
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIdentifier: vi.fn(() => 'client-1'),
  rateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock('@/server/entitlements/guard', () => ({ assertEntitlementOrThrow: mocks.assertEntitlementOrThrow }));
vi.mock('@/server/events/booking', () => ({ createEventBooking: mocks.createEventBooking }));

import { domainErrors, httpStatusFor } from '@/domain/errors';
import { POST } from './route';

const caller = { id: 'user-1', email: 'dancer@example.com', name: 'Dancer', role: 'CUSTOMER', locale: 'ru' };
const context = { params: Promise.resolve({ slug: 'bachata-night' }) };

function request() {
  return new Request('http://localhost/api/events/bachata-night/book', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCaller.mockResolvedValue(caller);
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.assertEntitlementOrThrow.mockResolvedValue(undefined);
  mocks.createEventBooking.mockResolvedValue({
    id: 'booking-1',
    reference: 'BK-OKING-1',
    totalPrice: 8_000,
    startsAt: new Date('2026-10-03T16:00:00Z'),
    endsAt: new Date('2026-10-03T19:00:00Z'),
    status: 'PENDING',
    title: 'Bachata Night',
  });
});

describe('POST /api/events/[slug]/book', () => {
  it('rejects anonymous callers without reserving a seat', async () => {
    mocks.getCaller.mockResolvedValue(null);

    const response = await POST(request(), context);

    expect(response.status).toBe(401);
    expect(mocks.createEventBooking).not.toHaveBeenCalled();
  });

  it('creates a booking for the caller and returns it with 201', async () => {
    const response = await POST(request(), context);

    expect(response.status).toBe(201);
    expect(mocks.assertEntitlementOrThrow).toHaveBeenCalledWith('events');
    expect(mocks.createEventBooking).toHaveBeenCalledWith({ userId: 'user-1', eventSlug: 'bachata-night' });
    expect(await response.json()).toMatchObject({
      booking: { id: 'booking-1', reference: 'BK-OKING-1', totalPrice: 8_000, status: 'PENDING', title: 'Bachata Night' },
    });
  });

  it('maps a full event to CAPACITY_EXCEEDED and returns no booking', async () => {
    mocks.createEventBooking.mockRejectedValue(domainErrors.capacityExceeded(0));

    const response = await POST(request(), context);

    expect(response.status).toBe(httpStatusFor('CAPACITY_EXCEEDED'));
    expect(await response.json()).toMatchObject({ error: 'CAPACITY_EXCEEDED' });
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it('returns the module-disabled error when events are off', async () => {
    mocks.assertEntitlementOrThrow.mockRejectedValue(domainErrors.featureDisabled());

    const response = await POST(request(), context);

    expect(response.status).toBe(httpStatusFor('FEATURE_DISABLED'));
    expect(mocks.createEventBooking).not.toHaveBeenCalled();
  });

  it('returns 429 before booking when rate limited', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });

    const response = await POST(request(), context);

    expect(response.status).toBe(429);
    expect(mocks.createEventBooking).not.toHaveBeenCalled();
  });
});

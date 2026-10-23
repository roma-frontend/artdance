import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireCaller: vi.fn(),
  checkRateLimit: vi.fn(),
  createBookingPayment: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ requireCaller: mocks.requireCaller }));
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIdentifier: vi.fn(() => 'client-1'),
  rateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock('@/server/payments/service', () => ({ createBookingPayment: mocks.createBookingPayment }));

import { domainErrors } from '@/domain/errors';
import { POST } from './route';

function request(body: unknown) {
  return new Request('http://localhost/api/booking/booking-1/pay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ id: 'booking-1' }) };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.requireCaller.mockResolvedValue({ id: 'customer-1', locale: 'ru' });
});

describe('POST /api/booking/[id]/pay', () => {
  it('returns 429 when the rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
    const response = await POST(request({ method: 'CARD' }), context);
    expect(response.status).toBe(429);
    expect(mocks.createBookingPayment).not.toHaveBeenCalled();
  });

  it('returns 400 for a body that is not JSON', async () => {
    const response = await POST(request('{not json'), context);
    expect(response.status).toBe(400);
    expect(mocks.createBookingPayment).not.toHaveBeenCalled();
  });

  it('returns 400 for an unknown payment method', async () => {
    const response = await POST(request({ method: 'BITCOIN' }), context);
    expect(response.status).toBe(400);
    expect(mocks.createBookingPayment).not.toHaveBeenCalled();
  });

  it('passes the booking, caller and method to the service and returns its result', async () => {
    mocks.createBookingPayment.mockResolvedValue({ bookingId: 'booking-1', paymentId: 'payment-1', amount: 17_000, redirectUrl: 'https://pay.example/x' });

    const response = await POST(request({ method: 'IDRAM', locale: 'hy' }), context);

    expect(mocks.createBookingPayment).toHaveBeenCalledWith({ bookingId: 'booking-1', userId: 'customer-1', method: 'IDRAM', locale: 'hy' });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ paymentId: 'payment-1', redirectUrl: 'https://pay.example/x' });
  });

  it('maps a domain error from the service to its HTTP status', async () => {
    mocks.createBookingPayment.mockRejectedValue(domainErrors.forbidden());
    const response = await POST(request({ method: 'CARD' }), context);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: 'FORBIDDEN' });
  });
});

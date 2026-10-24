import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCaller: vi.fn(),
  checkRateLimit: vi.fn(),
  createRecurringSeries: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ getCaller: mocks.getCaller }));
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIdentifier: vi.fn(() => 'client-1'),
  rateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock('@/server/recurring/service', () => ({ createRecurringSeries: mocks.createRecurringSeries }));

import { domainErrors } from '@/domain/errors';
import { POST } from './route';

const validBody = {
  weekday: 1,
  startTime: '10:00',
  durationMinutes: 60,
  weeks: 4,
  instructorId: 'instructor-1',
};

function request(body: unknown) {
  return new Request('http://localhost/api/booking/recurring', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.getCaller.mockResolvedValue({ id: 'customer-1' });
});

describe('POST /api/booking/recurring', () => {
  it('returns 429 with a messageKey and seconds param when rate limited', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });

    const response = await POST(request(validBody));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: 'RATE_LIMITED',
      messageKey: 'errors.rateLimited.description',
      params: { seconds: 30 },
    });
    expect(mocks.createRecurringSeries).not.toHaveBeenCalled();
  });

  it('keeps domain error params in the response', async () => {
    mocks.createRecurringSeries.mockRejectedValue(domainErrors.rateLimited(45));

    const response = await POST(request(validBody));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: 'RATE_LIMITED',
      messageKey: 'errors.rateLimited.description',
      params: { seconds: 45 },
    });
  });
});

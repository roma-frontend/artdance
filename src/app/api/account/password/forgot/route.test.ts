import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  assertCaptcha: vi.fn(),
  requestPasswordReset: vi.fn(),
}));

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIdentifier: vi.fn(() => 'client-1'),
  rateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock('@/server/safe-action', () => ({ assertCaptcha: mocks.assertCaptcha }));
vi.mock('@/lib/auth/auth', () => ({
  auth: { api: { requestPasswordReset: mocks.requestPasswordReset } },
}));

import { domainErrors } from '@/domain/errors';
import { POST } from './route';

function request(body: unknown) {
  return new Request('http://localhost/api/account/password/forgot', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.assertCaptcha.mockResolvedValue(undefined);
  mocks.requestPasswordReset.mockResolvedValue(undefined);
});

describe('POST /api/account/password/forgot', () => {
  it('requires a captcha even when the client sends fromApp=true', async () => {
    mocks.assertCaptcha.mockRejectedValue(domainErrors.captchaFailed());

    const response = await POST(request({ email: 'user@example.com', fromApp: true }));

    expect(mocks.assertCaptcha).toHaveBeenCalledWith(undefined, 'client-1');
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('sends the reset link after the captcha passes', async () => {
    const response = await POST(request({ email: 'user@example.com', captchaToken: 'token-1' }));

    expect(mocks.assertCaptcha).toHaveBeenCalledWith('token-1', 'client-1');
    expect(mocks.requestPasswordReset).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ email: 'user@example.com' }) }));
    expect(response.status).toBe(200);
  });
});

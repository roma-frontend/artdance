import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  assertCaptcha: vi.fn(),
  submitContactMessage: vi.fn(),
}));

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIdentifier: vi.fn(() => 'client-1'),
  rateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock('@/server/safe-action', () => ({ assertCaptcha: mocks.assertCaptcha }));
vi.mock('@/server/contact/service', () => ({
  contactMessageSchema: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    topic: z.string(),
    message: z.string().min(10),
    locale: z.string(),
    captchaToken: z.string().optional(),
  }),
  submitContactMessage: mocks.submitContactMessage,
}));

import { domainErrors } from '@/domain/errors';
import { POST } from './route';

const validBody = {
  name: 'Ани',
  email: 'ani@example.com',
  topic: 'general',
  message: 'Здравствуйте, у меня вопрос',
  locale: 'ru',
};

function request(body: unknown) {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.assertCaptcha.mockResolvedValue(undefined);
  mocks.submitContactMessage.mockResolvedValue({ delivered: true });
});

describe('POST /api/contact', () => {
  it('requires a captcha even when the client sends fromApp=true', async () => {
    mocks.assertCaptcha.mockRejectedValue(domainErrors.captchaFailed());

    const response = await POST(request({ ...validBody, fromApp: true }));

    expect(mocks.assertCaptcha).toHaveBeenCalledWith(undefined, 'client-1');
    expect(mocks.submitContactMessage).not.toHaveBeenCalled();
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('verifies the captcha token from the body and submits the message', async () => {
    const response = await POST(request({ ...validBody, captchaToken: 'token-1' }));

    expect(mocks.assertCaptcha).toHaveBeenCalledWith('token-1', 'client-1');
    expect(mocks.submitContactMessage).toHaveBeenCalledWith(expect.objectContaining({ email: 'ani@example.com' }));
    expect(response.status).toBe(200);
  });

  it('returns 429 without touching the captcha when rate limited', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });

    const response = await POST(request(validBody));

    expect(response.status).toBe(429);
    expect(mocks.assertCaptcha).not.toHaveBeenCalled();
    expect(mocks.submitContactMessage).not.toHaveBeenCalled();
  });
});

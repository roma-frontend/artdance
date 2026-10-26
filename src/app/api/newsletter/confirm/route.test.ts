import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cacheControl } from '@/config/cache';

const mocks = vi.hoisted(() => ({ confirm: vi.fn() }));

vi.mock('@/server/actions/newsletter', () => ({
  confirmNewsletterSubscription: mocks.confirm,
}));

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9, resetAt: 0, retryAfterSeconds: 0 })),
  clientIdentifier: () => 'test-ip',
  rateLimitHeaders: () => ({}),
}));

import { POST } from './route';

const TOKEN = 'a'.repeat(43);

function post(body: string) {
  return new Request('http://localhost/api/newsletter/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

describe('POST /api/newsletter/confirm', () => {
  beforeEach(() => {
    mocks.confirm.mockReset();
  });

  it('returns 200 and confirms when the token is known', async () => {
    mocks.confirm.mockResolvedValue(true);

    const response = await POST(post(JSON.stringify({ token: TOKEN })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.confirm).toHaveBeenCalledWith(TOKEN);
    expect(response.headers.get('Cache-Control')).toBe(cacheControl.none);
  });

  it('returns 404 when the token is unknown', async () => {
    mocks.confirm.mockResolvedValue(false);

    const response = await POST(post(JSON.stringify({ token: TOKEN })));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'NOT_FOUND' });
  });

  it.each([
    ['not json', 'not json'],
    ['missing token', JSON.stringify({})],
    ['too short', JSON.stringify({ token: 'short' })],
  ])('returns 400 without calling the action when the body is invalid (%s)', async (_label, body) => {
    const response = await POST(post(body));

    expect(response.status).toBe(400);
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
});

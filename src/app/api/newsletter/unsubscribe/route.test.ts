import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ unsubscribe: vi.fn() }));

vi.mock('@/server/actions/newsletter', () => ({
  unsubscribeFromNewsletter: mocks.unsubscribe,
}));

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9, resetAt: 0, retryAfterSeconds: 0 })),
  clientIdentifier: () => 'test-ip',
  rateLimitHeaders: () => ({}),
}));

import { POST } from './route';

const TOKEN = 'b'.repeat(43);

function post(body: string) {
  return new Request('http://localhost/api/newsletter/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

describe('POST /api/newsletter/unsubscribe', () => {
  beforeEach(() => {
    mocks.unsubscribe.mockReset();
  });

  it('returns 200 and unsubscribes when the token is known', async () => {
    mocks.unsubscribe.mockResolvedValue(true);

    const response = await POST(post(JSON.stringify({ token: TOKEN })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.unsubscribe).toHaveBeenCalledWith(TOKEN);
  });

  it('returns 404 when the token is unknown', async () => {
    mocks.unsubscribe.mockResolvedValue(false);

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
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
  });
});

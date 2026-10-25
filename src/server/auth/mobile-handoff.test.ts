import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const mocks = vi.hoisted(() => ({
  db: { verificationToken: { create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() } },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: mocks.db }));

import { consumeHandoffCode, createHandoffCode, isValidChallenge } from './mobile-handoff';

const verifier = 'v'.repeat(64);
const challenge = createHash('sha256').update(verifier).digest('base64url');
const now = new Date('2026-10-25T10:00:00Z');

beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.verificationToken.deleteMany.mockResolvedValue({ count: 1 });
});

describe('mobile auth handoff', () => {
  it('accepts only a base64url SHA-256 challenge', () => {
    expect(isValidChallenge(challenge)).toBe(true);
    expect(isValidChallenge('short')).toBe(false);
  });

  it('stores the session under a one-time code with a short expiry', async () => {
    const code = await createHandoffCode({ sessionToken: 'tok.sig', challenge, now });
    const data = mocks.db.verificationToken.create.mock.calls[0]?.[0].data as { identifier: string; value: string; expiresAt: Date };
    expect(data.identifier).toBe(`mobile-handoff:${code}`);
    expect(JSON.parse(data.value)).toEqual({ token: 'tok.sig', challenge });
    expect(data.expiresAt.getTime() - now.getTime()).toBe(120_000);
  });

  it('returns the token for the matching verifier and burns the code', async () => {
    mocks.db.verificationToken.findFirst.mockResolvedValue({ id: 'v1', value: JSON.stringify({ token: 'tok.sig', challenge }), expiresAt: new Date(now.getTime() + 60_000) });
    await expect(consumeHandoffCode({ code: 'c', verifier, now })).resolves.toBe('tok.sig');
    expect(mocks.db.verificationToken.deleteMany).toHaveBeenCalledWith({ where: { id: 'v1' } });
  });

  it('rejects a wrong verifier, an expired code and a code already used', async () => {
    mocks.db.verificationToken.findFirst.mockResolvedValue({ id: 'v1', value: JSON.stringify({ token: 'tok.sig', challenge }), expiresAt: new Date(now.getTime() + 60_000) });
    await expect(consumeHandoffCode({ code: 'c', verifier: 'x'.repeat(64), now })).resolves.toBeNull();

    mocks.db.verificationToken.findFirst.mockResolvedValue({ id: 'v1', value: JSON.stringify({ token: 'tok.sig', challenge }), expiresAt: new Date(now.getTime() - 1) });
    await expect(consumeHandoffCode({ code: 'c', verifier, now })).resolves.toBeNull();

    mocks.db.verificationToken.findFirst.mockResolvedValue({ id: 'v1', value: JSON.stringify({ token: 'tok.sig', challenge }), expiresAt: new Date(now.getTime() + 60_000) });
    mocks.db.verificationToken.deleteMany.mockResolvedValue({ count: 0 });
    await expect(consumeHandoffCode({ code: 'c', verifier, now })).resolves.toBeNull();
  });
});

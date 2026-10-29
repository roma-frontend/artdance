import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { bindReferralFromCookie } from './signup';

const h = vi.hoisted(() => ({
  cookies: vi.fn(),
  bindReferral: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: h.cookies }));
vi.mock('@/server/referral/service', () => ({ bindReferral: h.bindReferral }));

/** Имитирует `cookies()`: в хранилище есть только cookie `ref`, и только если значение задано. */
function givenRefCookie(value: string | undefined): void {
  h.cookies.mockResolvedValue({
    get: (name: string) => (name === 'ref' && value !== undefined ? { name, value } : undefined),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  h.bindReferral.mockResolvedValue({ referrerId: 'owner-1', id: 'ref-1' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('bindReferralFromCookie', () => {
  it('ничего не делает без cookie', async () => {
    givenRefCookie(undefined);

    await bindReferralFromCookie('user-1');

    expect(h.bindReferral).not.toHaveBeenCalled();
  });

  it('пропускает cookie с неверным значением', async () => {
    givenRefCookie('<bad>');

    await bindReferralFromCookie('user-1');

    expect(h.bindReferral).not.toHaveBeenCalled();
  });

  it('привязывает нормализованный код', async () => {
    givenRefCookie(' abc12345 ');

    await bindReferralFromCookie('user-1');

    expect(h.bindReferral).toHaveBeenCalledWith({ refereeId: 'user-1', code: 'ABC12345' });
  });

  it('не бросает, если привязка отказала, и пишет предупреждение', async () => {
    givenRefCookie('ABC12345');
    h.bindReferral.mockRejectedValue(new Error('already bound'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(bindReferralFromCookie('user-1')).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      '[referral] binding skipped',
      expect.objectContaining({ refereeId: 'user-1' }),
    );
  });

  it('не бросает, если cookies() недоступен вне запроса', async () => {
    h.cookies.mockRejectedValue(new Error('outside request scope'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(bindReferralFromCookie('user-1')).resolves.toBeUndefined();

    expect(h.bindReferral).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

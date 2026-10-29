import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bindReferral } from './service';

const h = vi.hoisted(() => {
  const tx = {
    referral: { updateMany: vi.fn() },
    user: { updateMany: vi.fn() },
  };
  return {
    tx,
    db: {
      referral: { findFirst: vi.fn() },
      $transaction: vi.fn(),
    },
    assertEntitlementOrThrow: vi.fn(),
    creditWallet: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({ db: h.db }));
vi.mock('@/server/entitlements/guard', () => ({
  assertEntitlementOrThrow: h.assertEntitlementOrThrow,
}));
vi.mock('@/server/wallet/service', () => ({ creditWallet: h.creditWallet }));

const OWNER = 'owner-1';
const FRIEND = 'friend-1';
const openReferral = { id: 'ref-1', referrerId: OWNER, refereeId: null };

/** Первый `findFirst` ищет реферал по коду, второй проверяет, не привязан ли приглашённый. */
function arrange(referral: unknown, existingForReferee: unknown = null): void {
  h.db.referral.findFirst.mockResolvedValueOnce(referral).mockResolvedValueOnce(existingForReferee);
}

beforeEach(() => {
  vi.resetAllMocks();
  h.assertEntitlementOrThrow.mockResolvedValue(undefined);
  h.db.$transaction.mockImplementation(async (fn: (client: typeof h.tx) => Promise<unknown>) =>
    fn(h.tx),
  );
  h.tx.referral.updateMany.mockResolvedValue({ count: 1 });
  h.tx.user.updateMany.mockResolvedValue({ count: 1 });
});

describe('bindReferral', () => {
  it('привязывает реферал и отмечает приглашённого в одной транзакции', async () => {
    arrange(openReferral);

    await expect(bindReferral({ refereeId: FRIEND, code: ' abc12345 ' })).resolves.toEqual({
      referrerId: OWNER,
      id: 'ref-1',
    });

    expect(h.assertEntitlementOrThrow).toHaveBeenCalledWith('referrals');
    expect(h.db.referral.findFirst.mock.calls[0]?.[0]).toEqual({ where: { code: 'ABC12345' } });
    expect(h.db.$transaction).toHaveBeenCalledTimes(1);
    expect(h.tx.referral.updateMany.mock.calls[0]?.[0]).toEqual({
      where: { id: 'ref-1', refereeId: null },
      data: { refereeId: FRIEND },
    });
    expect(h.tx.user.updateMany.mock.calls[0]?.[0]).toEqual({
      where: { id: FRIEND, referredById: null },
      data: { referredById: OWNER },
    });
  });

  it('не даёт пригласить самого себя', async () => {
    arrange({ ...openReferral, referrerId: FRIEND });

    await expect(bindReferral({ refereeId: FRIEND, code: 'ABC12345' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      field: 'code',
    });
    expect(h.db.$transaction).not.toHaveBeenCalled();
  });

  it('не привязывает приглашённого, который уже привязан к другому рефералу', async () => {
    arrange(openReferral, { id: 'ref-old' });

    await expect(bindReferral({ refereeId: FRIEND, code: 'ABC12345' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(h.db.$transaction).not.toHaveBeenCalled();
  });

  it('отвечает NOT_FOUND на неизвестный код', async () => {
    arrange(null);

    await expect(bindReferral({ refereeId: FRIEND, code: 'NOPE0000' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(h.db.$transaction).not.toHaveBeenCalled();
  });

  it('отказывает, если у реферала уже есть приглашённый', async () => {
    arrange({ ...openReferral, refereeId: 'someone-else' });

    await expect(bindReferral({ refereeId: FRIEND, code: 'ABC12345' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(h.db.$transaction).not.toHaveBeenCalled();
  });

  it('откатывает привязку, если реферал заняли между проверкой и записью', async () => {
    arrange(openReferral);
    h.tx.referral.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(bindReferral({ refereeId: FRIEND, code: 'ABC12345' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(h.tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('откатывает привязку, если у приглашённого уже стоит пригласивший', async () => {
    arrange(openReferral);
    h.tx.user.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(bindReferral({ refereeId: FRIEND, code: 'ABC12345' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ db: { giftCard: { findUnique } } }));

import { checkGiftCardCode } from './redeem';

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);

describe('checkGiftCardCode', () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it('normalises the code before lookup', async () => {
    findUnique.mockResolvedValue(null);
    await checkGiftCardCode('  abcd-1234 ');
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { code: 'ABCD-1234' } }));
  });

  it('returns notFound when no card matches', async () => {
    findUnique.mockResolvedValue(null);
    await expect(checkGiftCardCode('ABCD-1234')).resolves.toEqual({ ok: false, messageKey: 'giftCards.redeem.notFound' });
  });

  it('returns expired when the card date has passed', async () => {
    findUnique.mockResolvedValue({ id: 'g1', balance: 5000, initialAmount: 5000, expiresAt: past, redeemedAt: null });
    await expect(checkGiftCardCode('ABCD-1234')).resolves.toEqual({ ok: false, messageKey: 'giftCards.redeem.expired' });
  });

  it('returns alreadyRedeemed when the balance is empty', async () => {
    findUnique.mockResolvedValue({ id: 'g1', balance: 0, initialAmount: 5000, expiresAt: null, redeemedAt: new Date() });
    await expect(checkGiftCardCode('ABCD-1234')).resolves.toEqual({ ok: false, messageKey: 'giftCards.redeem.alreadyRedeemed' });
  });

  it('returns balance and ISO expiry for an active card', async () => {
    findUnique.mockResolvedValue({ id: 'g1', balance: 3000, initialAmount: 5000, expiresAt: future, redeemedAt: null });
    await expect(checkGiftCardCode('ABCD-1234')).resolves.toEqual({
      ok: true,
      balance: 3000,
      initialAmount: 5000,
      expiresAt: future.toISOString(),
    });
  });

  it('returns null expiry when the card has none', async () => {
    findUnique.mockResolvedValue({ id: 'g1', balance: 3000, initialAmount: 5000, expiresAt: null, redeemedAt: null });
    await expect(checkGiftCardCode('ABCD-1234')).resolves.toMatchObject({ ok: true, expiresAt: null });
  });
});

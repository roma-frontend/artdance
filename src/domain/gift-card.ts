/**
 * GIFT CARD (B-11) — промо/подарочные карты на чекауте.
 * remainingAmount = balance, Code нормализуется (trim upper).
 */

export function normalizeGiftCode(raw: string): string {
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (code.length < 6 || code.length > 24) throw Object.assign(new Error('invalid code'), { code: 'VALIDATION_FAILED', field: 'giftCardCode' });
  return code;
}

export function giftActive(card: { balance: number; expiresAt: Date; redeemedAt: Date | null }, now: Date): boolean {
  return card.balance > 0 && card.expiresAt.getTime() > now.getTime() && card.redeemedAt === null;
}

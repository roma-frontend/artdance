/**
 * GIFT CARDS — проверка кода подарочной карты без списания (A-21).
 *
 * Общая логика для веб-действия `redeemGiftCard` и API `/api/gift-cards/redeem`.
 * Файл без `'use server'`: сюда вынесено всё, что не должно быть экспортом server action.
 */

import { z } from 'zod';

import { db } from '@/lib/db';

export const redeemCodeSchema = z.object({ code: z.string().trim().min(4).max(24) });

export type GiftCardCheckFailure = 'giftCards.redeem.notFound' | 'giftCards.redeem.expired' | 'giftCards.redeem.alreadyRedeemed';

export type GiftCardCheck =
  | { ok: true; balance: number; initialAmount: number; expiresAt: string | null }
  | { ok: false; messageKey: GiftCardCheckFailure };

/** Находит карту по коду (регистр не важен) и возвращает баланс или причину отказа. */
export async function checkGiftCardCode(rawCode: string): Promise<GiftCardCheck> {
  const code = rawCode.trim().toUpperCase();
  const card = await db.giftCard.findUnique({
    where: { code },
    select: { id: true, balance: true, initialAmount: true, expiresAt: true, redeemedAt: true },
  });
  if (!card) return { ok: false, messageKey: 'giftCards.redeem.notFound' };
  if (card.expiresAt && new Date(card.expiresAt) < new Date()) return { ok: false, messageKey: 'giftCards.redeem.expired' };
  if (card.balance <= 0) return { ok: false, messageKey: 'giftCards.redeem.alreadyRedeemed' };
  return {
    ok: true,
    balance: card.balance,
    initialAmount: card.initialAmount,
    expiresAt: card.expiresAt ? card.expiresAt.toISOString() : null,
  };
}

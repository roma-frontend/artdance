'use server';

/**
 * GIFT CARDS — redeem по коду (A-21).
 */

import { z } from 'zod';

import { db } from '@/lib/db';
import { publicAction } from '@/server/safe-action';

const redeemSchema = z.object({ code: z.string().trim().min(4).max(24) });

export const redeemGiftCard = publicAction
  .metadata({ rateLimit: 'contactForm' })
  .inputSchema(redeemSchema)
  .action(async ({ parsedInput }) => {
    const code = parsedInput.code.trim().toUpperCase();
    const card = await db.giftCard.findUnique({ where: { code }, select: { id: true, balance: true, redeemedAt: true, expiresAt: true } });
    if (!card) return { ok: false as const, messageKey: 'giftCards.redeem.notFound' };
    if (card.redeemedAt) return { ok: false as const, messageKey: 'giftCards.redeem.alreadyRedeemed' };
    if (card.expiresAt && new Date(card.expiresAt) < new Date()) return { ok: false as const, messageKey: 'giftCards.redeem.expired' };
    await db.giftCard.update({ where: { id: card.id }, data: { redeemedAt: new Date() } });
    return { ok: true as const, balance: card.balance };
  });

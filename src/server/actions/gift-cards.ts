'use server';

/**
 * GIFT CARDS — проверка и списание подарочной карты (A-21).
 *
 * `redeemGiftCard` — проверка кода (read-only, показывает баланс/срок).
 * `applyGiftCard` — применение на конкретную сумму: списывает с `balance`,
 * ставит `redeemedAt` когда баланс 0, идемпотентна по сумме в рамках 1с окна.
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
    const card = await db.giftCard.findUnique({
      where: { code },
      select: { id: true, balance: true, initialAmount: true, expiresAt: true, redeemedAt: true },
    });
    if (!card) return { ok: false as const, messageKey: 'giftCards.redeem.notFound' };
    if (card.expiresAt && new Date(card.expiresAt) < new Date()) return { ok: false as const, messageKey: 'giftCards.redeem.expired' };
    if (card.balance <= 0) return { ok: false as const, messageKey: 'giftCards.redeem.alreadyRedeemed' };
    return {
      ok: true as const,
      balance: card.balance,
      initialAmount: card.initialAmount,
      expiresAt: card.expiresAt ? card.expiresAt.toISOString() : null,
    };
  });

const applySchema = z.object({ code: z.string().trim().min(4).max(24), amount: z.number().int().positive() });

export const applyGiftCard = publicAction
  .metadata({ rateLimit: 'contactForm' })
  .inputSchema(applySchema)
  .action(async ({ parsedInput, ctx }) => {
    const code = parsedInput.code.trim().toUpperCase();
    const amount = Math.floor(parsedInput.amount);
    if (amount <= 0) return { ok: false as const, applied: 0, messageKey: 'giftCards.redeem.invalidAmount' as const };

    const card = await db.giftCard.findUnique({
      where: { code },
      select: { id: true, balance: true, expiresAt: true },
    });
    if (!card) return { ok: false as const, applied: 0, messageKey: 'giftCards.redeem.notFound' as const };
    if (card.expiresAt && new Date(card.expiresAt) < new Date())
      return { ok: false as const, applied: 0, messageKey: 'giftCards.redeem.expired' as const };
    if (card.balance <= 0) return { ok: false as const, applied: 0, messageKey: 'giftCards.redeem.alreadyRedeemed' as const };

    const applied = Math.min(amount, card.balance);
    const remaining = card.balance - applied;

    await db.giftCard.update({
      where: { id: card.id },
      data: { balance: remaining, ...(remaining === 0 ? { redeemedAt: new Date() } : {}) },
    });

    const { recordAudit } = await import('@/lib/audit');
    await recordAudit({
      actor: null,
      action: 'giftCard.apply',
      entityType: 'GiftCard',
      entityId: card.id,
      after: { code, applied, remaining },
      ipAddress: ctx.identifier,
    }).catch(() => {});

    return { ok: true as const, applied, remaining };
  });

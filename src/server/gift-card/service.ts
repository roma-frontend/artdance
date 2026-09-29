import 'server-only';

import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { normalizeGiftCode, giftActive } from '@/domain/gift-card';

export async function validateGiftCard(code: string) {
  const normalized = normalizeGiftCode(code);
  const card = await db.giftCard.findUnique({ where: { code: normalized } });
  if (!card) throw domainErrors.notFound();
  return card as unknown as { id: string; code: string; balance: number; initialAmount: number; expiresAt: Date; redeemedAt: Date | null };
}

export async function applyGiftCardToOrder(input: { orderId: string; code: string; now: Date }) {
  const card = await validateGiftCard(input.code);
  if (!giftActive(card, input.now)) throw domainErrors.validationFailed('giftCardCode');
  const order = await db.order.findUnique({ where: { id: input.orderId }, select: { grandTotal: true, status: true } } as never);
  if (!order) throw domainErrors.notFound();
  const o = order as unknown as { grandTotal: number; status: string };
  if (o.status !== 'CREATED' && o.status !== 'PENDING_PAYMENT') throw domainErrors.validationFailed('orderId');
  const applied = Math.min(card.balance, o.grandTotal);
  if (applied <= 0) throw domainErrors.validationFailed('giftCardCode');
  // Record as discount snapshot in OrderItem or direct field — keep Order.discountTotal + link GiftCard.orderId for audit
  await db.$transaction(async (tx) => {
    await (tx as unknown as { giftCard: { update: (a: unknown) => Promise<unknown> } }).giftCard.update({ where: { id: card.id }, data: { balance: { decrement: applied } } } as never);
    await (tx as unknown as { order: { update: (a: unknown) => Promise<unknown> } }).order.update({ where: { id: input.orderId }, data: { discountTotal: { increment: applied }, giftCardId: card.id } } as never);
  });
  return { applied, remaining: card.balance - applied };
}

export async function createGiftCard(input: { purchaserId?: string | null; code: string; initialAmount: number; expiresAt: Date }) {
  if (input.initialAmount <= 0) throw domainErrors.validationFailed('amount');
  const code = normalizeGiftCode(input.code);
  return db.giftCard.create({ data: { code, initialAmount: input.initialAmount, balance: input.initialAmount, expiresAt: input.expiresAt, purchaserId: input.purchaserId ?? null } });
}

import 'server-only';

import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';

export async function ensureWallet(userId: string) {
  return db.walletAccount.upsert({
    where: { userId },
    create: { userId, balance: 0 },
    update: {},
    select: { id: true, balance: true },
  });
}

export async function walletBalance(userId: string): Promise<number> {
  const acc = await db.walletAccount.findUnique({ where: { userId }, select: { balance: true } });
  return acc?.balance ?? 0;
}

export async function creditWallet(input: { userId: string; amount: number; kind: string; refId?: string | null }) {
  if (input.amount <= 0) throw domainErrors.validationFailed('amount');
  const account = await ensureWallet(input.userId);
  // Dedup by WalletEntry.refId (credit for same booking only once)
  if (input.refId) {
    const existing = await db.walletEntry.findFirst({ where: { accountId: account.id, refId: input.refId } });
    if (existing) return { balance: account.balance, idempotent: true };
  }
  const updated = await db.$transaction(async (tx) => {
    await tx.walletEntry.create({ data: { accountId: account.id, amount: input.amount, kind: input.kind, refId: input.refId ?? null } });
    return tx.walletAccount.update({ where: { id: account.id }, data: { balance: { increment: input.amount } }, select: { balance: true } });
  });
  return { balance: updated.balance, idempotent: false };
}

export async function debitWallet(input: { userId: string; amount: number; kind: string; refId?: string | null }) {
  if (input.amount <= 0) throw domainErrors.validationFailed('amount');
  const account = await ensureWallet(input.userId);
  if (account.balance < input.amount) throw domainErrors.validationFailed('balance');
  if (input.refId) {
    const existing = await db.walletEntry.findFirst({ where: { accountId: account.id, refId: input.refId } });
    if (existing) return { balance: account.balance, idempotent: true };
  }
  const updated = await db.$transaction(async (tx) => {
    const fresh = await tx.walletAccount.findUnique({ where: { id: account.id }, select: { balance: true } });
    if (!fresh || fresh.balance < input.amount) throw domainErrors.validationFailed('balance');
    await tx.walletEntry.create({ data: { accountId: account.id, amount: -input.amount, kind: input.kind, refId: input.refId ?? null } });
    return tx.walletAccount.update({ where: { id: account.id }, data: { balance: { decrement: input.amount } }, select: { balance: true } });
  });
  return { balance: updated.balance, idempotent: false };
}

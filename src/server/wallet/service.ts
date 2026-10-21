import 'server-only';

import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';

async function assertWalletEnabled(): Promise<void> {
  await assertEntitlementOrThrow('wallet');
}

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
  /*
   * Тумблер спрашивается только у пополнений по нашей инициативе (акция, ручная
   * корректировка). Деньги по уже полученным платежам — возврат и оплаченное
   * пополнение — зачисляются всегда: если заказчик выключил кошелёк между
   * оплатой и доставкой, отказ означал бы «деньги взяли, баланс не дали».
   */
  const paidObligations = new Set(['CREDIT_REFUND', 'CREDIT_TOPUP']);
  if (!paidObligations.has(input.kind)) {
    await assertWalletEnabled();
  }
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
  /* То же, что у `creditWallet`: оплата уже начавшегося оформления гейту не подчиняется. */
  const paidObligations = new Set(['DEBIT_CHECKOUT']);
  if (!paidObligations.has(input.kind)) {
    await assertWalletEnabled();
  }
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

export async function applyWalletToPayment(input: { userId: string; amount: number; orderId: string }) {
  /*
   * Кошелёк гейтится в `createOrderPayment` до вызова: тумблер решает, появится
   * ли «списать баланс» в оформлении. Здесь проверки нет намеренно — баланс,
   * которым однажды уже заплатили, обязан доехать до заказа и после выключения
   * модуля, иначе оформление встанет на середине.
   */
  // Списывает не более баланса, идемпотентно по orderId — можно звать из reconcile/webhook повторно
  if (input.amount <= 0) return { applied: 0, balance: await walletBalance(input.userId) };
  const capped = Math.min(input.amount, await walletBalance(input.userId));
  if (capped <= 0) return { applied: 0, balance: 0 };
  const res = await debitWallet({ userId: input.userId, amount: capped, kind: 'DEBIT_CHECKOUT', refId: input.orderId });
  return { applied: res.idempotent ? 0 : capped, balance: res.balance };
}

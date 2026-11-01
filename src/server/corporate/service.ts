import 'server-only';

import { tax } from '@/config/business';
import { invoiceOverdue } from '@/domain/corporate';
import { domainErrors } from '@/domain/errors';
import { db } from '@/lib/db';

/** Номер счёта: префикс из `tax.invoiceNumberPrefix`, время в base36 и случайный хвост. */
function invoiceNumber(now: Date): string {
  const stamp = now.getTime().toString(36).toUpperCase();
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${tax.invoiceNumberPrefix}-${stamp}${tail}`;
}

export async function createCorporateAccount(input: { name: string; contactEmail: string }) {
  if (!input.name.trim() || !input.contactEmail.trim()) throw domainErrors.validationFailed('name');
  return db.corporateAccount.create({
    data: { name: input.name.trim(), contactEmail: input.contactEmail.trim().toLowerCase() },
    select: { id: true, name: true },
  });
}

export async function issueInvoice(input: { corporateAccountId: string; orderId?: string | null; amount: number }, now = new Date()) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw domainErrors.validationFailed('amount');
  const account = await db.corporateAccount.findUnique({ where: { id: input.corporateAccountId }, select: { id: true } });
  if (!account) throw domainErrors.notFound();
  return db.invoice.create({
    data: {
      corporateAccountId: input.corporateAccountId,
      orderId: input.orderId ?? null,
      number: invoiceNumber(now),
      amount: input.amount,
      issuedAt: now,
    },
    select: { id: true, number: true, amount: true, status: true },
  });
}

/**
 * Отмечает счёт оплаченным и пополняет баланс аккаунта. Переход делает условное
 * обновление `status = PENDING`: два администратора, нажавшие одновременно, не
 * увеличат баланс дважды, а второй получит ошибку.
 */
export async function markInvoicePaid(invoiceId: string, now = new Date()) {
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, status: true, amount: true, corporateAccountId: true },
    });
    if (!invoice) throw domainErrors.notFound();
    if (invoice.status !== 'PENDING') throw domainErrors.validationFailed('status');

    const moved = await tx.invoice.updateMany({
      where: { id: invoiceId, status: 'PENDING' },
      data: { status: 'PAID', paidAt: now },
    });
    if (moved.count === 0) throw domainErrors.validationFailed('status');

    if (invoice.corporateAccountId) {
      await tx.corporateAccount.update({
        where: { id: invoice.corporateAccountId },
        data: { balance: { increment: invoice.amount } },
      });
    }
    return { id: invoice.id, amount: invoice.amount, status: 'PAID' as const, corporateAccountId: invoice.corporateAccountId };
  });
}

export interface CorporateAccountRow {
  id: string;
  name: string;
  contactEmail: string;
  balance: number;
  openInvoices: number;
}

/** Аккаунты с балансом и числом неоплаченных счетов. */
export async function listCorporateAccounts(): Promise<CorporateAccountRow[]> {
  const accounts = await db.corporateAccount.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      contactEmail: true,
      balance: true,
      _count: { select: { invoices: { where: { status: 'PENDING' } } } },
    },
  });
  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    contactEmail: account.contactEmail,
    balance: account.balance,
    openInvoices: account._count.invoices,
  }));
}

export interface CorporateInvoiceRow {
  id: string;
  number: string;
  amount: number;
  status: string;
  issuedAt: Date;
  paidAt: Date | null;
  overdue: boolean;
  account: { id: string; name: string } | null;
}

/** Последние счета с признаком просрочки; просрочен только неоплаченный счёт старше срока. */
export async function listCorporateInvoices(now = new Date(), limit = 200): Promise<CorporateInvoiceRow[]> {
  const invoices = await db.invoice.findMany({
    orderBy: { issuedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      number: true,
      amount: true,
      status: true,
      issuedAt: true,
      paidAt: true,
      corporateAccount: { select: { id: true, name: true } },
    },
  });
  return invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    amount: invoice.amount,
    status: invoice.status,
    issuedAt: invoice.issuedAt,
    paidAt: invoice.paidAt,
    overdue: invoice.status === 'PENDING' && invoiceOverdue(invoice.issuedAt, null, now, tax.invoiceDueHours),
    account: invoice.corporateAccount,
  }));
}

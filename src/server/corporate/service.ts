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

/**
 * Выставляет счёт. Со ссылкой на заказ сумма равна сумме заказа, а не числу из формы:
 * счёт не может разойтись с тем, что компания должна за заказ.
 */
export async function issueInvoice(
  input: { corporateAccountId: string; orderId?: string | null; amount?: number | null },
  now = new Date(),
) {
  if (!input.orderId && (!Number.isInteger(input.amount) || (input.amount ?? 0) <= 0)) {
    throw domainErrors.validationFailed('amount');
  }
  const account = await db.corporateAccount.findUnique({ where: { id: input.corporateAccountId }, select: { id: true } });
  if (!account) throw domainErrors.notFound();

  let amount = input.amount ?? 0;
  if (input.orderId) {
    const order = await db.order.findUnique({ where: { id: input.orderId }, select: { status: true, total: true } });
    if (!order) throw domainErrors.notFound();
    if (order.status !== 'CREATED') throw domainErrors.validationFailed('status');
    const invoiced = await db.invoice.findUnique({ where: { orderId: input.orderId }, select: { id: true } });
    if (invoiced) throw domainErrors.validationFailed('order');
    amount = order.total;
  }
  if (!Number.isInteger(amount) || amount <= 0) throw domainErrors.validationFailed('amount');

  return db.invoice.create({
    data: {
      corporateAccountId: input.corporateAccountId,
      orderId: input.orderId ?? null,
      number: invoiceNumber(now),
      amount,
      issuedAt: now,
    },
    select: { id: true, number: true, amount: true, status: true },
  });
}

/**
 * Привязывает пользователя к компании: из её кабинета видны баланс и счета. Пустой
 * `corporateAccountId` отвязывает. Назначает только админ с правом `corporate.manage`.
 */
export async function setCorporateMember(input: { email: string; corporateAccountId: string | null }) {
  const user = await db.user.findUnique({ where: { email: input.email.trim().toLowerCase() }, select: { id: true } });
  if (!user) throw domainErrors.notFound();
  if (input.corporateAccountId) {
    const account = await db.corporateAccount.findUnique({ where: { id: input.corporateAccountId }, select: { id: true } });
    if (!account) throw domainErrors.notFound();
  }
  return db.user.update({
    where: { id: user.id },
    data: { corporateAccountId: input.corporateAccountId },
    select: { id: true, corporateAccountId: true },
  });
}

/** Кабинет компании: баланс и последние счета; `null`, если пользователь не в компании. */
export async function corporateCabinetFor(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      corporateAccount: {
        select: {
          name: true,
          balance: true,
          invoices: {
            orderBy: { issuedAt: 'desc' },
            take: 50,
            select: {
              number: true,
              amount: true,
              status: true,
              issuedAt: true,
              paidAt: true,
              order: { select: { orderNumber: true } },
            },
          },
        },
      },
    },
  });
  return user?.corporateAccount ?? null;
}

/**
 * Проверка перед заявкой на списание: счёт по заказу оплачен, заказ ещё не оплачен,
 * баланса хватает. Вызывается и при подаче заявки, и при её исполнении.
 */
export async function prepareCorporateOrderDebit(input: { corporateAccountId: string; orderId: string }) {
  const invoice = await db.invoice.findUnique({
    where: { orderId: input.orderId },
    select: { id: true, status: true, corporateAccountId: true },
  });
  if (!invoice || invoice.corporateAccountId !== input.corporateAccountId || invoice.status !== 'PAID') {
    throw domainErrors.validationFailed('invoice');
  }
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    select: { status: true, total: true, orderNumber: true },
  });
  if (!order) throw domainErrors.notFound();
  if (order.status !== 'CREATED') throw domainErrors.validationFailed('status');
  const account = await db.corporateAccount.findUnique({
    where: { id: input.corporateAccountId },
    select: { balance: true },
  });
  if (!account || account.balance < order.total) throw domainErrors.validationFailed('balance');
  return { invoiceId: invoice.id, orderId: input.orderId, orderNumber: order.orderNumber, amount: order.total };
}

/**
 * Списывает баланс компании за заказ и переводит заказ в оплаченный. Условные
 * обновления защищают от двойного списания: второй вызов упадёт на статусе заказа.
 * Доставку запускает `settlePaidOrder`, как и при оплате провайдером.
 */
export async function debitCorporateForOrder(input: { corporateAccountId: string; orderId: string }, now = new Date()) {
  const debit = await db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { orderId: input.orderId },
      select: { status: true, corporateAccountId: true },
    });
    if (!invoice || invoice.corporateAccountId !== input.corporateAccountId || invoice.status !== 'PAID') {
      throw domainErrors.validationFailed('invoice');
    }
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: { status: true, total: true, orderNumber: true },
    });
    if (!order) throw domainErrors.notFound();

    const charged = await tx.corporateAccount.updateMany({
      where: { id: input.corporateAccountId, balance: { gte: order.total } },
      data: { balance: { decrement: order.total } },
    });
    if (charged.count !== 1) throw domainErrors.validationFailed('balance');

    const paid = await tx.order.updateMany({
      where: { id: input.orderId, status: 'CREATED' },
      data: { status: 'PAID', paidAt: now },
    });
    if (paid.count !== 1) throw domainErrors.validationFailed('status');

    return { orderId: input.orderId, orderNumber: order.orderNumber, amount: order.total };
  });

  const { settlePaidOrder } = await import('@/server/payments/settle');
  await settlePaidOrder(debit.orderId, now);
  return debit;
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
  order: { id: string; orderNumber: string } | null;
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
      order: { select: { id: true, orderNumber: true } },
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
    order: invoice.order,
  }));
}

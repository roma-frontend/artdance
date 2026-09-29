import 'server-only';

import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';

function invoiceNumber(): string {
  return 'INV-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export async function createCorporateAccount(input: { name: string; contactEmail: string }) {
  if (!input.name.trim() || !input.contactEmail.trim()) throw domainErrors.validationFailed('name');
  return db.corporateAccount.create({ data: { name: input.name.trim(), contactEmail: input.contactEmail.trim().toLowerCase() }, select: { id: true, name: true } });
}

export async function issueInvoice(input: { corporateAccountId: string; orderId?: string | null; amount: number }) {
  if (input.amount <= 0) throw domainErrors.validationFailed('amount');
  const account = await db.corporateAccount.findUnique({ where: { id: input.corporateAccountId } });
  if (!account) throw domainErrors.notFound();
  return db.invoice.create({
    data: { corporateAccountId: input.corporateAccountId, orderId: input.orderId ?? null, number: invoiceNumber(), amount: input.amount },
    select: { id: true, number: true, amount: true, status: true },
  });
}

export async function markInvoicePaid(invoiceId: string) {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw domainErrors.notFound();
  if (invoice.status === 'PAID') return invoice;
  const updated = await db.invoice.update({ where: { id: invoiceId }, data: { status: 'PAID', paidAt: new Date() }, select: { id: true, corporateAccountId: true, amount: true, status: true } });
  if (updated.corporateAccountId) {
    await db.corporateAccount.update({ where: { id: updated.corporateAccountId }, data: { balance: { increment: updated.amount } } });
  }
  return updated;
}

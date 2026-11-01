import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const tx = {
    invoice: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    corporateAccount: { update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  };
  return { tx };
});

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: (fn: (tx: unknown) => unknown) => fn(h.tx),
    invoice: h.tx.invoice,
    corporateAccount: h.tx.corporateAccount,
  },
}));

import { tax } from '@/config/business';

import { issueInvoice, listCorporateInvoices, markInvoicePaid } from './service';

const now = new Date('2026-10-31T12:00:00Z');

describe('markInvoicePaid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('не находит счёт — ошибка, баланс не трогаем', async () => {
    h.tx.invoice.findUnique.mockResolvedValue(null);

    await expect(markInvoicePaid('missing', now)).rejects.toThrow();
    expect(h.tx.invoice.updateMany).not.toHaveBeenCalled();
    expect(h.tx.corporateAccount.update).not.toHaveBeenCalled();
  });

  it('уже оплаченный или отменённый счёт не оплачивается повторно', async () => {
    h.tx.invoice.findUnique.mockResolvedValue({ id: 'i1', status: 'PAID', amount: 50_000, corporateAccountId: 'a1' });

    await expect(markInvoicePaid('i1', now)).rejects.toThrow();
    expect(h.tx.invoice.updateMany).not.toHaveBeenCalled();
    expect(h.tx.corporateAccount.update).not.toHaveBeenCalled();
  });

  it('при гонке второго администратора баланс не увеличивается', async () => {
    h.tx.invoice.findUnique.mockResolvedValue({ id: 'i1', status: 'PENDING', amount: 50_000, corporateAccountId: 'a1' });
    h.tx.invoice.updateMany.mockResolvedValue({ count: 0 });

    await expect(markInvoicePaid('i1', now)).rejects.toThrow();
    expect(h.tx.corporateAccount.update).not.toHaveBeenCalled();
  });

  it('оплата переводит счёт в PAID условно и пополняет баланс на сумму счёта', async () => {
    h.tx.invoice.findUnique.mockResolvedValue({ id: 'i1', status: 'PENDING', amount: 50_000, corporateAccountId: 'a1' });
    h.tx.invoice.updateMany.mockResolvedValue({ count: 1 });

    const result = await markInvoicePaid('i1', now);

    expect(h.tx.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'i1', status: 'PENDING' },
      data: { status: 'PAID', paidAt: now },
    });
    expect(h.tx.corporateAccount.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { balance: { increment: 50_000 } },
    });
    expect(result).toEqual({ id: 'i1', amount: 50_000, status: 'PAID', corporateAccountId: 'a1' });
  });

  it('счёт без аккаунта оплачивается, но баланса нет', async () => {
    h.tx.invoice.findUnique.mockResolvedValue({ id: 'i2', status: 'PENDING', amount: 10_000, corporateAccountId: null });
    h.tx.invoice.updateMany.mockResolvedValue({ count: 1 });

    await markInvoicePaid('i2', now);

    expect(h.tx.corporateAccount.update).not.toHaveBeenCalled();
  });
});

describe('issueInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('отклоняет нулевую и дробную сумму до обращения к базе', async () => {
    await expect(issueInvoice({ corporateAccountId: 'a1', amount: 0 }, now)).rejects.toThrow();
    await expect(issueInvoice({ corporateAccountId: 'a1', amount: 10.5 }, now)).rejects.toThrow();
    expect(h.tx.corporateAccount.findUnique).not.toHaveBeenCalled();
    expect(h.tx.invoice.create).not.toHaveBeenCalled();
  });

  it('номер счёта начинается с префикса из конфигурации', async () => {
    h.tx.corporateAccount.findUnique.mockResolvedValue({ id: 'a1' });
    h.tx.invoice.create.mockImplementation(async ({ data }: { data: { number: string } }) => ({
      id: 'i9',
      number: data.number,
      amount: 50_000,
      status: 'PENDING',
    }));

    const invoice = await issueInvoice({ corporateAccountId: 'a1', amount: 50_000 }, now);

    expect(invoice.number.startsWith(`${tax.invoiceNumberPrefix}-`)).toBe(true);
    expect(h.tx.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ corporateAccountId: 'a1', amount: 50_000, issuedAt: now }) }),
    );
  });
});

describe('listCorporateInvoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('помечает просроченным только неоплаченный счёт старше срока', async () => {
    const dueMs = tax.invoiceDueHours * 60 * 60 * 1000;
    const account = { id: 'a1', name: 'Acme' };
    h.tx.invoice.findMany.mockResolvedValue([
      { id: 'old-pending', number: 'AD-1', amount: 1, status: 'PENDING', issuedAt: new Date(now.getTime() - dueMs - 1), paidAt: null, corporateAccount: account },
      { id: 'fresh-pending', number: 'AD-2', amount: 1, status: 'PENDING', issuedAt: new Date(now.getTime() - 1000), paidAt: null, corporateAccount: account },
      { id: 'old-paid', number: 'AD-3', amount: 1, status: 'PAID', issuedAt: new Date(now.getTime() - dueMs - 1), paidAt: now, corporateAccount: account },
    ]);

    const rows = await listCorporateInvoices(now);

    expect(rows.map((row) => [row.id, row.overdue])).toEqual([
      ['old-pending', true],
      ['fresh-pending', false],
      ['old-paid', false],
    ]);
  });
});

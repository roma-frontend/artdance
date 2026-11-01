import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const db = {
    $transaction: vi.fn(),
    invoice: { findUnique: vi.fn(), create: vi.fn() },
    order: { findUnique: vi.fn(), updateMany: vi.fn() },
    corporateAccount: { findUnique: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
  };
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  return { db, settlePaidOrder: vi.fn() };
});

vi.mock('@/lib/db', () => ({ db: h.db }));
vi.mock('@/server/payments/settle', () => ({ settlePaidOrder: h.settlePaidOrder }));

import { debitCorporateForOrder, issueInvoice, prepareCorporateOrderDebit, setCorporateMember } from './service';

const now = new Date('2026-11-01T12:00:00Z');

describe('issueInvoice со ссылкой на заказ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.db.$transaction.mockImplementation((fn: (tx: typeof h.db) => unknown) => fn(h.db));
  });

  it('сумма счёта равна сумме заказа, а не числу из формы', async () => {
    h.db.corporateAccount.findUnique.mockResolvedValue({ id: 'a1' });
    h.db.order.findUnique.mockResolvedValue({ status: 'CREATED', total: 30_000 });
    h.db.invoice.findUnique.mockResolvedValue(null);
    h.db.invoice.create.mockImplementation(({ data }: { data: unknown }) => ({ id: 'i1', ...(data as object) }));

    await issueInvoice({ corporateAccountId: 'a1', orderId: 'o1', amount: 1 }, now);

    expect(h.db.invoice.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: 30_000, orderId: 'o1' }) }));
  });

  it('заказ уже оплачен или в работе — счёт не выставляется', async () => {
    h.db.corporateAccount.findUnique.mockResolvedValue({ id: 'a1' });
    h.db.order.findUnique.mockResolvedValue({ status: 'PAID', total: 30_000 });

    await expect(issueInvoice({ corporateAccountId: 'a1', orderId: 'o1' }, now)).rejects.toThrow();
    expect(h.db.invoice.create).not.toHaveBeenCalled();
  });

  it('на один заказ — один счёт', async () => {
    h.db.corporateAccount.findUnique.mockResolvedValue({ id: 'a1' });
    h.db.order.findUnique.mockResolvedValue({ status: 'CREATED', total: 30_000 });
    h.db.invoice.findUnique.mockResolvedValue({ id: 'old' });

    await expect(issueInvoice({ corporateAccountId: 'a1', orderId: 'o1' }, now)).rejects.toThrow();
    expect(h.db.invoice.create).not.toHaveBeenCalled();
  });
});

describe('списание баланса за заказ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.db.$transaction.mockImplementation((fn: (tx: typeof h.db) => unknown) => fn(h.db));
  });

  it('списывает сумму заказа, переводит заказ в оплаченный и запускает доставку', async () => {
    h.db.invoice.findUnique.mockResolvedValue({ status: 'PAID', corporateAccountId: 'a1' });
    h.db.order.findUnique.mockResolvedValue({ status: 'CREATED', total: 30_000, orderNumber: 'ORD-1' });
    h.db.corporateAccount.updateMany.mockResolvedValue({ count: 1 });
    h.db.order.updateMany.mockResolvedValue({ count: 1 });

    const result = await debitCorporateForOrder({ corporateAccountId: 'a1', orderId: 'o1' }, now);

    expect(h.db.corporateAccount.updateMany).toHaveBeenCalledWith({
      where: { id: 'a1', balance: { gte: 30_000 } },
      data: { balance: { decrement: 30_000 } },
    });
    expect(h.db.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'o1', status: 'CREATED' },
      data: { status: 'PAID', paidAt: now },
    });
    expect(h.settlePaidOrder).toHaveBeenCalledWith('o1', now);
    expect(result).toEqual({ orderId: 'o1', orderNumber: 'ORD-1', amount: 30_000 });
  });

  it('баланса не хватает — ни списания, ни оплаты заказа', async () => {
    h.db.invoice.findUnique.mockResolvedValue({ status: 'PAID', corporateAccountId: 'a1' });
    h.db.order.findUnique.mockResolvedValue({ status: 'CREATED', total: 30_000, orderNumber: 'ORD-1' });
    h.db.corporateAccount.updateMany.mockResolvedValue({ count: 0 });

    await expect(debitCorporateForOrder({ corporateAccountId: 'a1', orderId: 'o1' }, now)).rejects.toThrow();
    expect(h.db.order.updateMany).not.toHaveBeenCalled();
    expect(h.settlePaidOrder).not.toHaveBeenCalled();
  });

  it('счёт не оплачен или чужой — списания нет', async () => {
    h.db.invoice.findUnique.mockResolvedValue({ status: 'PENDING', corporateAccountId: 'a1' });

    await expect(debitCorporateForOrder({ corporateAccountId: 'a1', orderId: 'o1' }, now)).rejects.toThrow();
    expect(h.db.corporateAccount.updateMany).not.toHaveBeenCalled();
  });

  it('проверка заявки отказывает, если баланса меньше суммы заказа', async () => {
    h.db.invoice.findUnique.mockResolvedValue({ id: 'i1', status: 'PAID', corporateAccountId: 'a1' });
    h.db.order.findUnique.mockResolvedValue({ status: 'CREATED', total: 30_000, orderNumber: 'ORD-1' });
    h.db.corporateAccount.findUnique.mockResolvedValue({ balance: 10_000 });

    await expect(prepareCorporateOrderDebit({ corporateAccountId: 'a1', orderId: 'o1' })).rejects.toThrow();
  });
});

describe('привязка пользователя к компании', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('неизвестный адрес — ошибка, привязки нет', async () => {
    h.db.user.findUnique.mockResolvedValue(null);

    await expect(setCorporateMember({ email: 'nobody@example.test', corporateAccountId: 'a1' })).rejects.toThrow();
    expect(h.db.user.update).not.toHaveBeenCalled();
  });

  it('адрес приводится к нижнему регистру и привязывается к компании', async () => {
    h.db.user.findUnique.mockResolvedValue({ id: 'u1' });
    h.db.corporateAccount.findUnique.mockResolvedValue({ id: 'a1' });
    h.db.user.update.mockResolvedValue({ id: 'u1', corporateAccountId: 'a1' });

    const result = await setCorporateMember({ email: ' Client@Example.TEST ', corporateAccountId: 'a1' });

    expect(h.db.user.findUnique).toHaveBeenCalledWith({ where: { email: 'client@example.test' }, select: { id: true } });
    expect(h.db.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { corporateAccountId: 'a1' } }));
    expect(result.corporateAccountId).toBe('a1');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    order: { findUnique: vi.fn(), updateMany: vi.fn() },
    payment: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
  provider: { id: 'mock', createPayment: vi.fn() },
  providerForMethod: vi.fn(),
  getPaymentProvider: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/lib/payments', () => ({
  getPaymentProvider: mocks.getPaymentProvider,
  providerForMethod: mocks.providerForMethod,
}));
vi.mock('@/server/entitlements/service', () => ({ getEffectiveEntitlementsSafe: vi.fn() }));
vi.mock('@/server/wallet/service', () => ({ applyWalletToPayment: vi.fn() }));

import { createOrderPayment } from './service';

const createdOrder = {
  id: 'order-1',
  orderNumber: 'ADTRTEST01',
  userId: null,
  anonymousId: 'anon-12345678',
  status: 'CREATED',
  total: 30_500,
  walletApplied: 0,
  contactEmail: 'guest@example.com',
  contactPhone: '+37499123456',
  contactName: 'Guest',
  currencyCode: 'AMD',
  items: [{ titleSnapshot: 'Bag', quantity: 1 }],
};

const input = { orderId: 'order-1', userId: null, method: 'CASH_ON_DELIVERY' as const, locale: 'ru', anonymousId: 'anon-12345678' };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getPaymentProvider.mockReturnValue(mocks.provider);
  mocks.providerForMethod.mockReturnValue(mocks.provider);
  mocks.db.order.findUnique.mockResolvedValue(createdOrder);
  mocks.db.order.updateMany.mockResolvedValue({ count: 1 });
  mocks.provider.createPayment.mockResolvedValue({
    provider: 'mock',
    providerTransactionId: 'tx-1',
    redirectUrl: 'https://pay.example/tx-1',
    qrPayload: null,
    status: 'PENDING',
  });
  mocks.db.payment.create.mockResolvedValue({ id: 'payment-1' });
  mocks.db.payment.update.mockResolvedValue({});
  mocks.db.payment.findUnique.mockResolvedValue(null);
});

describe('createOrderPayment', () => {
  it('cash on delivery moves the order to PACKING without contacting a provider', async () => {
    const result = await createOrderPayment(input);

    expect(mocks.db.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: 'CREATED' },
      data: { status: 'PACKING' },
    });
    expect(mocks.provider.createPayment).not.toHaveBeenCalled();
    expect(mocks.db.payment.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'PENDING', redirectUrl: null, amount: 30_500, settledByWallet: false });
  });

  it('card payment still goes to the provider and is not marked PACKING', async () => {
    const result = await createOrderPayment({ ...input, method: 'CARD' });

    expect(mocks.db.order.updateMany).not.toHaveBeenCalled();
    expect(mocks.provider.createPayment).toHaveBeenCalledTimes(1);
    expect(result.redirectUrl).toBe('https://pay.example/tx-1');
  });

  it('reissues a card attempt on the same payment row when the previous session expired', async () => {
    mocks.db.payment.findUnique.mockResolvedValue({
      id: 'payment-1',
      status: 'PENDING',
      providerTransactionId: 'cs_old',
      providerPayload: { redirectUrl: 'https://old.example', expiresAt: new Date(Date.now() - 60_000).toISOString() },
    });
    mocks.db.payment.update.mockResolvedValueOnce({ id: 'payment-1' });

    const result = await createOrderPayment({ ...input, method: 'CARD' });

    expect(mocks.db.payment.create).not.toHaveBeenCalled();
    expect(mocks.provider.createPayment).toHaveBeenCalledWith(expect.objectContaining({ paymentId: 'payment-1', amount: 30_500 }));
    expect(mocks.db.payment.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'payment-1' }, data: { status: 'PENDING' } }));
    expect(result.redirectUrl).toBe('https://pay.example/tx-1');
  });

  it('reissues a card attempt when the previous one FAILED', async () => {
    mocks.db.payment.findUnique.mockResolvedValue({
      id: 'payment-1',
      status: 'FAILED',
      providerTransactionId: 'cs_old',
      providerPayload: { redirectUrl: 'https://old.example' },
    });

    const result = await createOrderPayment({ ...input, method: 'CARD' });

    expect(mocks.provider.createPayment).toHaveBeenCalledTimes(1);
    expect(result.redirectUrl).toBe('https://pay.example/tx-1');
  });

  it('returns the live attempt without calling the provider again', async () => {
    mocks.db.payment.findUnique.mockResolvedValue({
      id: 'payment-1',
      status: 'PENDING',
      providerTransactionId: 'cs_live',
      providerPayload: { redirectUrl: 'https://live.example', expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
    });

    const result = await createOrderPayment({ ...input, method: 'CARD' });

    expect(mocks.provider.createPayment).not.toHaveBeenCalled();
    expect(result.redirectUrl).toBe('https://live.example');
  });
});

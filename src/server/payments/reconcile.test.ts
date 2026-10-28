import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: { NODE_ENV: 'development' as string },
  db: {
    payment: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    order: { findUnique: vi.fn(), update: vi.fn() },
  },
  getPayment: vi.fn(),
  getPaymentProvider: vi.fn(),
  recordAudit: vi.fn(),
  settlePaidOrder: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/config/env', () => ({
  clientEnv: { NEXT_PUBLIC_APP_URL: 'https://artdance.test' },
  getServerEnv: () => mocks.env,
}));
vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/lib/payments', () => ({ getPaymentProvider: mocks.getPaymentProvider }));
vi.mock('@/lib/audit', () => ({ recordAudit: mocks.recordAudit }));
vi.mock('@/server/payments/settle', () => ({ settlePaidOrder: mocks.settlePaidOrder }));

import { reconcilePayment } from './reconcile';

const mockPayment = {
  id: 'pay-1',
  provider: 'mock',
  providerTransactionId: 'mock_abc',
  status: 'PENDING',
  amount: 17_000,
  orderId: 'order-1',
  bookingId: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.NODE_ENV = 'development';
  mocks.getPaymentProvider.mockReturnValue({ getPayment: mocks.getPayment });
  mocks.db.payment.findUnique.mockResolvedValue(mockPayment);
  mocks.db.payment.findFirst.mockResolvedValue(null);
  mocks.db.payment.update.mockResolvedValue({});
  mocks.db.order.findUnique.mockResolvedValue({ status: 'CREATED' });
  mocks.db.order.update.mockResolvedValue({});
  mocks.settlePaidOrder.mockResolvedValue(undefined);
});

describe('reconcilePayment с тестовым исходом mock-платежа', () => {
  it('PAID: проводит платёж и подтверждает заказ без опроса провайдера', async () => {
    const result = await reconcilePayment({ paymentId: 'pay-1', simulatedOutcome: 'PAID' });

    expect(result.status).toBe('PAID');
    expect(mocks.getPayment).not.toHaveBeenCalled();
    expect(mocks.db.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PAID', paidAmount: 17_000 }) }),
    );
    expect(mocks.db.order.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'order-1' } }));
    expect(mocks.settlePaidOrder).toHaveBeenCalledWith('order-1');
  });

  it('FAILED: фиксирует отказ с кодом SIMULATED_DECLINE и не подтверждает заказ', async () => {
    const result = await reconcilePayment({ paymentId: 'pay-1', simulatedOutcome: 'FAILED' });

    expect(result.status).toBe('FAILED');
    expect(mocks.db.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', paidAmount: 0, failureCode: 'SIMULATED_DECLINE' }),
      }),
    );
    expect(mocks.db.order.update).not.toHaveBeenCalled();
    expect(mocks.settlePaidOrder).not.toHaveBeenCalled();
  });

  it('отказывает для провайдера, который не mock', async () => {
    mocks.db.payment.findUnique.mockResolvedValue({ ...mockPayment, provider: 'stripe', providerTransactionId: 'pi_1' });

    await expect(reconcilePayment({ paymentId: 'pay-1', simulatedOutcome: 'PAID' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(mocks.db.payment.update).not.toHaveBeenCalled();
  });

  it('проводит mock и в production: демо-стенд не зависит от окружения', async () => {
    mocks.env.NODE_ENV = 'production';

    const result = await reconcilePayment({ paymentId: 'pay-1', simulatedOutcome: 'PAID' });

    expect(result.status).toBe('PAID');
    expect(mocks.settlePaidOrder).toHaveBeenCalledWith('order-1');
  });
});

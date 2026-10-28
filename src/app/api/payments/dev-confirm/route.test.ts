import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: { NODE_ENV: 'development' as string, STRIPE_SECRET_KEY: undefined as string | undefined },
  caller: null as null | { id: string },
  db: {
    payment: { findFirst: vi.fn() },
    order: { findUnique: vi.fn() },
    booking: { findUnique: vi.fn() },
  },
  reconcilePayment: vi.fn(),
}));

vi.mock('@/config/env', () => ({
  clientEnv: { NEXT_PUBLIC_APP_URL: 'https://artdance.test' },
  getServerEnv: () => mocks.env,
}));
vi.mock('@/config/security', () => ({ isSupportOperator: () => false }));
vi.mock('@/lib/auth/guards', () => ({ getCaller: async () => mocks.caller }));
vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/server/payments/reconcile', () => ({ reconcilePayment: mocks.reconcilePayment }));

import { POST } from './route';

function request(body: unknown) {
  return new Request('https://artdance.test/api/payments/dev-confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.NODE_ENV = 'development';
  mocks.env.STRIPE_SECRET_KEY = undefined;
  mocks.caller = { id: 'user-1' };
  mocks.db.payment.findFirst.mockResolvedValue({ id: 'pay-1', provider: 'mock', orderId: 'order-1', bookingId: null });
  mocks.db.order.findUnique.mockResolvedValue({ userId: 'user-1', anonymousId: null });
  mocks.reconcilePayment.mockResolvedValue({ status: 'PAID' });
});

describe('POST /api/payments/dev-confirm (mock)', () => {
  it('mock проводится и в production: демо-стенд не зависит от окружения', async () => {
    mocks.env.NODE_ENV = 'production';

    const response = await POST(request({ providerTransactionId: 'mock_abc', scenario: 'success' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'PAID' });
    expect(mocks.reconcilePayment).toHaveBeenCalledWith({ paymentId: 'pay-1', simulatedOutcome: 'PAID' });
  });

  it('возвращает 401 без входа и без гостевого ключа, не обращаясь к базе', async () => {
    mocks.caller = null;

    const response = await POST(request({ providerTransactionId: 'mock_abc', scenario: 'success' }));

    expect(response.status).toBe(401);
    expect(mocks.db.payment.findFirst).not.toHaveBeenCalled();
  });

  it('успешный сценарий проводит платёж как PAID', async () => {
    const response = await POST(request({ providerTransactionId: 'mock_abc', scenario: 'success' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'PAID' });
    expect(mocks.reconcilePayment).toHaveBeenCalledWith({ paymentId: 'pay-1', simulatedOutcome: 'PAID' });
  });

  it('сценарий отказа возвращает declined', async () => {
    mocks.reconcilePayment.mockResolvedValue({ status: 'FAILED' });

    const response = await POST(request({ providerTransactionId: 'mock_abc', scenario: 'declined' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'declined' });
    expect(mocks.reconcilePayment).toHaveBeenCalledWith({ paymentId: 'pay-1', simulatedOutcome: 'FAILED' });
  });

  it('возвращает 403 для чужого заказа и ничего не проводит', async () => {
    mocks.db.order.findUnique.mockResolvedValue({ userId: 'someone-else', anonymousId: null });

    const response = await POST(request({ providerTransactionId: 'mock_abc', scenario: 'success' }));

    expect(response.status).toBe(403);
    expect(mocks.reconcilePayment).not.toHaveBeenCalled();
  });
});

describe('POST /api/payments/dev-confirm: гостевой заказ', () => {
  beforeEach(() => {
    mocks.caller = null;
    mocks.db.order.findUnique.mockResolvedValue({ userId: null, anonymousId: 'anon-guest-1' });
  });

  it('гость с совпадающим anonymousId проводит свой заказ', async () => {
    const response = await POST(
      request({ providerTransactionId: 'mock_abc', scenario: 'success', anonymousId: 'anon-guest-1' }),
    );

    expect(response.status).toBe(200);
    expect(mocks.reconcilePayment).toHaveBeenCalledWith({ paymentId: 'pay-1', simulatedOutcome: 'PAID' });
  });

  it('гость с чужим anonymousId получает 403 и ничего не проводит', async () => {
    const response = await POST(
      request({ providerTransactionId: 'mock_abc', scenario: 'success', anonymousId: 'anon-other-2' }),
    );

    expect(response.status).toBe(403);
    expect(mocks.reconcilePayment).not.toHaveBeenCalled();
  });

  it('гость не подтверждает заказ, у которого есть владелец-пользователь', async () => {
    mocks.db.order.findUnique.mockResolvedValue({ userId: 'user-1', anonymousId: 'anon-guest-1' });

    const response = await POST(
      request({ providerTransactionId: 'mock_abc', scenario: 'success', anonymousId: 'anon-guest-1' }),
    );

    expect(response.status).toBe(403);
    expect(mocks.reconcilePayment).not.toHaveBeenCalled();
  });
});

describe('POST /api/payments/dev-confirm: Stripe', () => {
  beforeEach(() => {
    mocks.db.payment.findFirst.mockResolvedValue({ id: 'pay-1', provider: 'stripe', orderId: 'order-1', bookingId: null });
  });

  it('в production отвечает 404 даже с тестовым ключом', async () => {
    mocks.env.NODE_ENV = 'production';
    mocks.env.STRIPE_SECRET_KEY = ['sk', 'test', 'unit'].join('_');

    const response = await POST(request({ providerTransactionId: 'pi_123', scenario: 'success' }));

    expect(response.status).toBe(404);
    expect(mocks.reconcilePayment).not.toHaveBeenCalled();
  });

  it('без тестового ключа sk_test_ отвечает 404', async () => {
    mocks.env.STRIPE_SECRET_KEY = ['sk', 'live', 'unit'].join('_');

    const response = await POST(request({ providerTransactionId: 'pi_123', scenario: 'success' }));

    expect(response.status).toBe(404);
    expect(mocks.reconcilePayment).not.toHaveBeenCalled();
  });
});

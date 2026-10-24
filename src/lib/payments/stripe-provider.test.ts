import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sessionCreate: vi.fn(),
  sessionRetrieve: vi.fn(),
  piRetrieve: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/config/env', () => ({
  clientEnv: { NEXT_PUBLIC_APP_URL: 'https://artdance.test' },
  getServerEnv: () => ({ STRIPE_SECRET_KEY: 'sk_test_unit', STRIPE_WEBHOOK_SECRET: 'whsec_unit' }),
}));
vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { create: mocks.sessionCreate, retrieve: mocks.sessionRetrieve } };
    paymentIntents = { retrieve: mocks.piRetrieve };
  },
}));

import { money, type Money } from '@/domain/money';

import { createStripeProvider } from './stripe-provider';
import type { PaymentOrderRef } from './types';

const order: PaymentOrderRef = {
  paymentId: 'pay-1',
  orderNumber: 'ADTRTEST01',
  amount: money(30_500) as Money,
  currencyCode: 'USD',
  description: 'Order ADTRTEST01',
  method: 'CARD',
  locale: 'en',
  customer: { email: 'guest@example.com' },
  returnUrl: 'https://artdance.test/en/checkout/result/ADTRTEST01',
};

beforeEach(() => {
  mocks.sessionCreate.mockReset();
  mocks.sessionRetrieve.mockReset();
  mocks.piRetrieve.mockReset();
});

describe('stripe provider: hosted Checkout Session', () => {
  it('creates a payment-mode session and returns its hosted url as redirect', async () => {
    mocks.sessionCreate.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
      expires_at: 1_900_000_000,
    });

    const intent = await createStripeProvider().createPayment(order);

    expect(mocks.sessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        client_reference_id: 'ADTRTEST01',
        success_url: order.returnUrl,
        cancel_url: order.returnUrl,
        line_items: [expect.objectContaining({ quantity: 1, price_data: expect.objectContaining({ currency: 'usd', unit_amount: 3_050_000 }) })],
      }),
    );
    expect(intent).toMatchObject({
      provider: 'stripe',
      providerTransactionId: 'cs_test_1',
      status: 'PENDING',
      redirectUrl: 'https://checkout.stripe.com/c/pay/cs_test_1',
    });
    expect(intent.expiresAt).toEqual(new Date(1_900_000_000 * 1000));
  });

  it('throws when Stripe returns a session without url', async () => {
    mocks.sessionCreate.mockResolvedValue({ id: 'cs_test_2', url: null });
    await expect(createStripeProvider().createPayment(order)).rejects.toThrow(/no url/);
  });

  it('reports PAID for a paid session and sums amount_total', async () => {
    mocks.sessionRetrieve.mockResolvedValue({ id: 'cs_test_1', payment_status: 'paid', status: 'complete', amount_total: 3_050_000, currency: 'usd' });
    const snap = await createStripeProvider().getPayment('cs_test_1');
    expect(mocks.sessionRetrieve).toHaveBeenCalledWith('cs_test_1');
    expect(snap.status).toBe('PAID');
    expect(snap.paidAmount).toBe(30_500);
  });

  it('reports PENDING while the session is open and unpaid', async () => {
    mocks.sessionRetrieve.mockResolvedValue({ id: 'cs_test_1', payment_status: 'unpaid', status: 'open', amount_total: 3_050_000, currency: 'usd' });
    const snap = await createStripeProvider().getPayment('cs_test_1');
    expect(snap.status).toBe('PENDING');
    expect(snap.paidAmount).toBe(0);
  });

  it('reports CANCELLED for an expired unpaid session', async () => {
    mocks.sessionRetrieve.mockResolvedValue({ id: 'cs_test_1', payment_status: 'unpaid', status: 'expired', amount_total: 3_050_000, currency: 'usd' });
    const snap = await createStripeProvider().getPayment('cs_test_1');
    expect(snap.status).toBe('CANCELLED');
  });

  it('keeps PaymentIntent lookups for pi_ ids', async () => {
    mocks.piRetrieve.mockResolvedValue({ id: 'pi_1', status: 'succeeded', amount: 3_050_000, currency: 'usd' });
    const snap = await createStripeProvider().getPayment('pi_1');
    expect(mocks.piRetrieve).toHaveBeenCalledWith('pi_1');
    expect(mocks.sessionRetrieve).not.toHaveBeenCalled();
    expect(snap.status).toBe('PAID');
  });
});

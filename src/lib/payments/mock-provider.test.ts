import { describe, expect, it } from 'vitest';

import { mockPaymentProvider } from './mock-provider';
import type { PaymentOrderRef } from './types';

const order: PaymentOrderRef = {
  paymentId: 'pay-1',
  orderNumber: 'ADTRTEST01',
  amount: 17_000,
  currencyCode: 'AMD',
  description: 'Тестовый заказ',
  method: 'CARD',
  locale: 'ru',
  customer: { email: 'guest@example.com' },
  returnUrl: 'https://artdance.test/checkout/return?orderNumber=ADTRTEST01',
};

describe('mockPaymentProvider.createPayment', () => {
  it('для оплаты в приложении отдаёт clientSecret и не отдаёт redirect', async () => {
    const intent = await mockPaymentProvider.createPayment({ ...order, inAppSheet: true });

    expect(intent.providerTransactionId).toMatch(/^mock_/);
    expect(intent.status).toBe('PENDING');
    expect(intent.redirectUrl).toBeNull();
    expect(intent.clientSecret).toBe(`${intent.providerTransactionId}_secret`);
  });

  it('для веба сохраняет redirect на returnUrl и не отдаёт clientSecret', async () => {
    const intent = await mockPaymentProvider.createPayment(order);

    expect(intent.clientSecret).toBeUndefined();
    expect(intent.redirectUrl).toContain(`transactionId=${intent.providerTransactionId}`);
  });
});

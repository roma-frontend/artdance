import { describe, expect, it } from 'vitest';

import { getPaymentProvider } from '@/lib/payments';

describe('payments mock: 5.1-5.5', () => {
  it('5.1 registry resolves mock', () => {
    const p = getPaymentProvider('mock');
    expect(p.id).toBe('mock');
    expect(p.supportsPartialRefund).toBe(true);
    expect(p.supportedMethods.length).toBeGreaterThan(0);
  });

  it('5.1 → 5.5 create → getPayment (PENDING→PAID) → refund idempotent', async () => {
    const p = getPaymentProvider('mock');
    const intent = await p.createPayment({
      paymentId: 'pay_test',
      orderNumber: 'ORD-TEST-001',
      amount: 200 as never, // …0 — success path
      currencyCode: 'AMD',
      description: 'test payment',
      method: 'CARD',
      locale: 'ru',
      customer: { email: 'a@example.com' },
      returnUrl: 'https://example.com/return',
    });
    expect(intent.providerTransactionId).toMatch(/^mock_/);
    expect(intent.status).toBe('PENDING');

    // 200 (…)2 = PENDING→вторая проверка PAID — один и тот же id
    const pendingTx = await p.createPayment({
      paymentId: 'pay_test_pending',
      orderNumber: 'ORD-TEST-002',
      amount: 202 as never,
      currencyCode: 'AMD',
      description: 'pending test',
      method: 'CARD',
      locale: 'ru',
      customer: {},
      returnUrl: 'https://example.com/return',
    });
    const snap1 = await p.getPayment(pendingTx.providerTransactionId);
    expect(snap1.status).toBe('PENDING');
    const snap2 = await p.getPayment(pendingTx.providerTransactionId);
    expect(snap2.status).toBe('PAID');

    // refund — идемпотентность по providerRefundId; проверяем на той же транзакции mock
    const r1 = await p.refund({
      providerTransactionId: pendingTx.providerTransactionId,
      amount: 100 as never,
      reason: 'partial',
      idempotencyKey: 'refund_idem_1',
    });
    expect(r1.status).toBe('PARTIALLY_REFUNDED');
    const r2 = await p.refund({
      providerTransactionId: pendingTx.providerTransactionId,
      amount: 100 as never,
      reason: 'partial',
      idempotencyKey: 'refund_idem_1',
    });
    expect(r2.providerRefundId).toBe(r1.providerRefundId);
  });

  it('parseWebhook never correlates to paid without getPayment (5.3 contract shape)', async () => {
    const p = getPaymentProvider('mock');
    const evt = await p.parseWebhook({
      rawBody: JSON.stringify({ eventId: 'evt_1', transactionId: 'mock_x', status: 'PAID', amount: 100 }),
      headers: {},
    });
    expect(evt.eventId).toBe('evt_1');
    expect(evt.providerTransactionId).toBe('mock_x');
    expect(evt.status).toBe('PAID');
  });
});

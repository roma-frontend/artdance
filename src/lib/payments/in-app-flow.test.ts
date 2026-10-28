import { describe, expect, it } from 'vitest';

import { paymentFlow } from './in-app-flow';

const stubAttempt = {
  provider: 'mock' as const,
  providerTransactionId: 'mock_1f2e3d4c',
  clientSecret: 'attempt-secret-1',
  publishableKey: null,
  settledByWallet: false,
};

const stripeAttempt = {
  provider: 'stripe' as const,
  providerTransactionId: 'pi_test_1',
  clientSecret: 'attempt-secret-2',
  publishableKey: 'pk_test_placeholder',
  settledByWallet: false,
};

describe('paymentFlow', () => {
  it('заказ, закрытый балансом, не открывает форму', () => {
    const attempt = { ...stubAttempt, settledByWallet: true, clientSecret: null, providerTransactionId: null };
    expect(paymentFlow(attempt, 'CARD')).toEqual({ kind: 'done' });
  });

  it('наличные при получении не требуют оплаты сейчас', () => {
    const attempt = { ...stubAttempt, clientSecret: null, providerTransactionId: null };
    expect(paymentFlow(attempt, 'CASH_ON_DELIVERY')).toEqual({ kind: 'done' });
  });

  it('заглушка получает форму с тестовыми картами', () => {
    expect(paymentFlow(stubAttempt, 'ARCA')).toEqual({
      kind: 'test-card',
      providerTransactionId: 'mock_1f2e3d4c',
      clientSecret: 'attempt-secret-1',
    });
  });

  it('Stripe открывает Payment Element с публикуемым ключом', () => {
    expect(paymentFlow(stripeAttempt, 'CARD')).toEqual({
      kind: 'stripe',
      providerTransactionId: 'pi_test_1',
      clientSecret: 'attempt-secret-2',
      publishableKey: 'pk_test_placeholder',
    });
  });

  it('Stripe без публикуемого ключа недоступен, форму вслепую не открываем', () => {
    expect(paymentFlow({ ...stripeAttempt, publishableKey: null }, 'CARD')).toEqual({ kind: 'unavailable' });
  });

  it('ответ без секрета недоступен: встроенной формы нет', () => {
    expect(paymentFlow({ ...stubAttempt, clientSecret: null }, 'ARCA')).toEqual({ kind: 'unavailable' });
  });

  it('ответ без идентификатора транзакции недоступен', () => {
    expect(paymentFlow({ ...stubAttempt, providerTransactionId: null }, 'ARCA')).toEqual({ kind: 'unavailable' });
  });
});

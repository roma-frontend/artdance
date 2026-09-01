/**
 * MOCK-провайдер. Позволяет разрабатывать и тестировать весь checkout/booking
 * до подписания договора с банком — это снимает главную блокировку по срокам.
 *
 * Поведение управляется суммой платежа: последняя цифра задаёт сценарий,
 * чтобы e2e-тесты не требовали конфигурации.
 *   …0  — успешная оплата
 *   …1  — отказ
 *   …2  — «в обработке» (проверяется повторным `getPayment`)
 */

import { randomUUID } from 'node:crypto';

import type { PaymentMethod } from '@/domain/enums';
import { paymentMethods } from '@/domain/enums';
import { money, type Money } from '@/domain/money';
import { booking } from '@/config/business';

import type {
  PaymentIntent,
  PaymentOrderRef,
  PaymentProvider,
  PaymentSnapshot,
  RefundRequest,
  RefundResult,
  WebhookEvent,
  WebhookVerificationInput,
} from './types';

interface MockRecord {
  amount: Money;
  status: PaymentSnapshot['status'];
  attempts: number;
}

const store = new Map<string, MockRecord>();

function scenarioFor(amount: Money): PaymentSnapshot['status'] {
  switch (money(amount) % 10) {
    case 1:
      return 'FAILED';
    case 2:
      return 'PENDING';
    default:
      return 'PAID';
  }
}

export const mockPaymentProvider: PaymentProvider = {
  id: 'mock',
  supportedMethods: paymentMethods as readonly PaymentMethod[],
  supportsPartialRefund: true,

  async createPayment(order: PaymentOrderRef): Promise<PaymentIntent> {
    const providerTransactionId = `mock_${randomUUID()}`;
    store.set(providerTransactionId, {
      amount: order.amount,
      status: scenarioFor(order.amount),
      attempts: 0,
    });

    const url = new URL(order.returnUrl);
    url.searchParams.set('transactionId', providerTransactionId);

    return {
      provider: 'mock',
      providerTransactionId,
      status: 'PENDING',
      redirectUrl: url.toString(),
      expiresAt: new Date(Date.now() + booking.holdTtlMinutes * 60_000),
    };
  },

  async getPayment(providerTransactionId: string): Promise<PaymentSnapshot> {
    const record = store.get(providerTransactionId);
    if (!record) {
      return {
        providerTransactionId,
        status: 'FAILED',
        paidAmount: 0,
        failureCode: 'NOT_FOUND',
        failureMessage: 'Unknown mock transaction',
        raw: null,
      };
    }

    record.attempts += 1;
    /** «PENDING» превращается в «PAID» со второй проверки — имитация задержки. */
    const status = record.status === 'PENDING' && record.attempts > 1 ? 'PAID' : record.status;

    return {
      providerTransactionId,
      status,
      paidAmount: status === 'PAID' ? record.amount : 0,
      raw: { ...record, status },
    };
  },

  async refund(request: RefundRequest): Promise<RefundResult> {
    const record = store.get(request.providerTransactionId);
    const refunded = record ? Math.min(request.amount, record.amount) : 0;
    if (record) {
      record.status = refunded >= record.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    }
    return {
      providerRefundId: `mock_refund_${request.idempotencyKey}`,
      status: record?.status ?? 'FAILED',
      refundedAmount: refunded,
      raw: { request },
    };
  },

  async parseWebhook(input: WebhookVerificationInput): Promise<WebhookEvent> {
    const payload = JSON.parse(input.rawBody) as {
      eventId?: string;
      transactionId: string;
      status: PaymentSnapshot['status'];
      amount: number;
    };
    return {
      eventId: payload.eventId ?? `mock_evt_${payload.transactionId}`,
      providerTransactionId: payload.transactionId,
      status: payload.status,
      amount: money(payload.amount),
      occurredAt: new Date(),
      raw: payload,
    };
  },
};

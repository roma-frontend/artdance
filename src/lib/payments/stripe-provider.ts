/**
 * STRIPE — глобальный провайдер карт.
 *
 * PCI без карты на нашей стороне: карта вводится на Hosted/redirect странице Stripe,
 * мы не храним номер. Поддерживает 135+ валют, 3DS, partial refund; webhook
 * дедуплицируется по (provider,eventId) в Payment/WebhookEvent.
 */

import 'server-only';

import Stripe from 'stripe';

import type { PaymentMethod } from '@/domain/enums';
import { money, type Money } from '@/domain/money';
import { getServerEnv } from '@/config/env';

import { PaymentProviderError, type PaymentIntent, type PaymentOrderRef, type PaymentProvider, type PaymentSnapshot, type RefundRequest, type RefundResult, type WebhookEvent, type WebhookVerificationInput } from './types';

function envStripe(): Stripe | null {
  const env = getServerEnv();
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2024-12-18.acl' as never });
}

function toMinor(amount: Money, currency: string): number {
  // AMD/USD/EUR — целые драмы/центы; для AMD minorUnitsPerUnit=1, для остальных 100
  // Stripe ожидает minor units: 1 AMD = 1, 1 USD = 100
  const zeroDecimal = new Set(['JPY', 'KRW']);
  if (zeroDecimal.has(currency.toUpperCase())) return Math.round(money(amount));
  return Math.round(money(amount) * 100);
}

function fromMinor(minor: number, currency: string): Money {
  const zeroDecimal = new Set(['JPY', 'KRW']);
  if (zeroDecimal.has(currency.toUpperCase())) return money(minor) as Money;
  return money(Math.round(minor / 100)) as Money;
}

function mapStripeStatus(pi: Stripe.PaymentIntent): PaymentSnapshot['status'] {
  switch (pi.status) {
    case 'succeeded': return 'PAID';
    case 'requires_action':
    case 'requires_capture':
    case 'processing':
      return 'PENDING';
    case 'canceled': return 'CANCELLED';
    default: return 'FAILED';
  }
}

export function createStripeProvider(): PaymentProvider {
  return {
    id: 'stripe',
    supportedMethods: ['CARD'] as const as readonly PaymentMethod[],
    supportsPartialRefund: true,
    supportsInlineCard: false,

    async createPayment(order: PaymentOrderRef): Promise<PaymentIntent> {
      const stripe = envStripe();
      if (!stripe) throw new PaymentProviderError('stripe', 'STRIPE_SECRET_KEY missing — set in .env/.env.local and Vercel env');

      const pi = await stripe.paymentIntents.create({
        amount: toMinor(order.amount, order.currencyCode),
        currency: order.currencyCode.toLowerCase(),
        description: order.description.slice(0, 255),
        metadata: { paymentId: order.paymentId, orderNumber: order.orderNumber },
        automatic_payment_methods: { enabled: true, allow_redirects: 'always' },
        receipt_email: order.customer.email || undefined,
      });

      // redirect — Checkout/hosted берётся из next redirectUrl в order.returnUrl
      // Для PaymentIntent с automatic PM redirectUrl — секрет клиента, возвращаем returnUrl
      return {
        provider: 'stripe',
        providerTransactionId: pi.id,
        status: mapStripeStatus(pi) === 'PAID' ? 'PAID' : 'PENDING',
        redirectUrl: order.returnUrl,
        expiresAt: undefined,
      };
    },

    async getPayment(providerTransactionId: string): Promise<PaymentSnapshot> {
      const stripe = envStripe();
      if (!stripe) throw new PaymentProviderError('stripe', 'STRIPE_SECRET_KEY missing');
      const pi = await stripe.paymentIntents.retrieve(providerTransactionId);
      const status = mapStripeStatus(pi);
      const paidAmount = status === 'PAID' ? fromMinor(pi.amount, pi.currency ?? 'usd') : money(0) as Money;
      return {
        providerTransactionId: pi.id,
        status,
        paidAmount,
        failureCode: status === 'FAILED' ? (pi.last_payment_error?.code ?? 'FAILED') : undefined,
        failureMessage: status === 'FAILED' ? (pi.last_payment_error?.message ?? null) as string | undefined : undefined,
        raw: pi,
      };
    },

    async refund(request: RefundRequest): Promise<RefundResult> {
      const stripe = envStripe();
      if (!stripe) throw new PaymentProviderError('stripe', 'STRIPE_SECRET_KEY missing');
      const refund = await stripe.refunds.create({
        payment_intent: request.providerTransactionId,
        amount: toMinor(request.amount, 'amd'), // покупки в AMD, рефанд в той же валюте транзакции — Stripe пересчитает
        metadata: { idempotencyKey: request.idempotencyKey },
      });
      const refunded = refund.amount as number;
      const currency = (refund.currency ?? 'amd').toString();
      return {
        providerRefundId: refund.id,
        status: refund.status === 'succeeded' ? 'REFUNDED' : 'PENDING',
        refundedAmount: fromMinor(refunded, currency),
        raw: refund,
      };
    },

    async parseWebhook(input: WebhookVerificationInput): Promise<WebhookEvent> {
      const env = getServerEnv();
      const secret = env.STRIPE_WEBHOOK_SECRET;
      const stripe = envStripe();
      if (!stripe || !secret) throw new PaymentProviderError('stripe', 'STRIPE_WEBHOOK_SECRET / key missing');
      const sig = input.headers['stripe-signature'] ?? input.headers['Stripe-Signature'] ?? '';
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(input.rawBody, sig, secret);
      } catch (e) {
        throw new PaymentProviderError('stripe', `Webhook sig failed: ${(e as Error).message}`);
      }
      // Поддерживаем payment_intent.succeeded / payment_intent.payment_failed
      const obj = event.data.object as unknown as Stripe.PaymentIntent | { id?: string; amount?: number };
      const piId = (obj as Stripe.PaymentIntent).id ?? (obj as Record<string, unknown>).id as string ?? event.id;
      const amountMinor = (obj as Stripe.PaymentIntent).amount ?? (obj as Record<string, number>).amount ?? 0;
      const currency = (obj as Stripe.PaymentIntent).currency ?? 'amd';
      const status: PaymentSnapshot['status'] =
        event.type.includes('succeeded') ? 'PAID' :
        event.type.includes('failed') || event.type.includes('canceled') ? 'FAILED' : 'PENDING';
      return {
        eventId: event.id,
        providerTransactionId: piId,
        status,
        amount: fromMinor(amountMinor, currency),
        occurredAt: new Date(event.created * 1000),
        raw: event,
      };
    },
  };
}

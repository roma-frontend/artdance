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

function mapCheckoutSessionStatus(session: Stripe.Checkout.Session): PaymentSnapshot['status'] {
  if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') return 'PAID';
  if (session.status === 'expired') return 'CANCELLED';
  return 'PENDING';
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

      // Hosted Checkout: карта вводится на странице Stripe, мы получаем session.url для redirect.
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: order.currencyCode.toLowerCase(),
              unit_amount: toMinor(order.amount, order.currencyCode),
              product_data: { name: (order.description || order.orderNumber).slice(0, 250) },
            },
          },
        ],
        client_reference_id: order.orderNumber,
        customer_email: order.customer.email || undefined,
        metadata: { paymentId: order.paymentId, orderNumber: order.orderNumber },
        payment_intent_data: {
          description: order.description.slice(0, 255),
          metadata: { paymentId: order.paymentId, orderNumber: order.orderNumber },
        },
        success_url: order.returnUrl,
        cancel_url: order.returnUrl,
      });

      if (!session.url) throw new PaymentProviderError('stripe', 'Stripe Checkout Session returned no url');

      return {
        provider: 'stripe',
        // Идентификатор сессии (cs_...) — по нему getPayment и webhook находят платёж.
        providerTransactionId: session.id,
        status: 'PENDING',
        redirectUrl: session.url,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
      };
    },

    async getPayment(providerTransactionId: string): Promise<PaymentSnapshot> {
      const stripe = envStripe();
      if (!stripe) throw new PaymentProviderError('stripe', 'STRIPE_SECRET_KEY missing');

      if (providerTransactionId.startsWith('cs_')) {
        const session = await stripe.checkout.sessions.retrieve(providerTransactionId);
        const status = mapCheckoutSessionStatus(session);
        return {
          providerTransactionId: session.id,
          status,
          paidAmount: status === 'PAID' ? fromMinor(session.amount_total ?? 0, session.currency ?? 'amd') : money(0) as Money,
          failureCode: undefined,
          failureMessage: undefined,
          raw: session,
        };
      }

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
      // Поддерживаем checkout.session.* (Hosted Checkout, id = cs_...) и payment_intent.*.
      // Статус из события только предварительный: webhooks.ts подтверждает его через getPayment().
      const obj = event.data.object as unknown as { id?: string; amount?: number | null; amount_total?: number | null; currency?: string | null };
      const piId = obj.id ?? event.id;
      const amountMinor = obj.amount_total ?? obj.amount ?? 0;
      const currency = obj.currency ?? 'amd';
      const status: PaymentSnapshot['status'] =
        event.type.includes('succeeded') || event.type === 'checkout.session.completed' ? 'PAID' :
        event.type === 'checkout.session.expired' ? 'CANCELLED' :
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

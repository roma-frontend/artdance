/**
 * PAYMENTS WEBHOOKS — 5.2 + 5.3 + 5.4 фундамент.
 *
 * • 5.2 Проверка подписи (src/lib/security/webhook.ts), сырое тело без JSON-parse,
 *       дедупликация по WebhookEvent (provider,eventId) + никогда не 500.
 * • 5.3 Подтверждение брони/заказа только после provider.getPayment().
 * • 5.4 Возвраты — частичные, идемпотентность по Refund.idempotencyKey
 *       и PaymentProvider.refund(idempotencyKey).
 *
 * Идемпотентность везде: повторная доставка того же eventId = 200 без побочек.
 */

import 'server-only';

import { randomUUID } from 'node:crypto';

import { getServerEnv } from '@/config/env';
import { db } from '@/lib/db';
import { getPaymentProvider, type PaymentProviderId } from '@/lib/payments';
import { recordAudit } from '@/lib/audit';
import { verifyBodySignature, verifyTimestampedSignature } from '@/lib/security/webhook';
import { webhookSecurity } from '@/config/security';

export interface ProcessWebhookInput {
  /** Путь вида /api/webhooks/payments/:provider — оттуда берётся provider. */
  provider: PaymentProviderId;
  rawBody: string;
  headers: Record<string, string>;
}

function providerSecret(provider: PaymentProviderId): string | undefined {
  const env = getServerEnv();
  if (provider === 'paynet') return env.PAYNET_WEBHOOK_SECRET;
  if (provider === 'mock') return 'mock'; // mock — без подписи
  return undefined;
}

function errorMessageOf(error: unknown): string {
  return String((error as { message?: unknown })?.message ?? error).slice(0, 1000);
}

function toHeadersRecord(requestHeaders: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(requestHeaders)) out[k.toLowerCase()] = v;
  return out;
}

/** Сохраняет сырое событие, даже если подпись не сошлась — нужно для разбора. */
async function persistWebhookEvent(input: {
  provider: string;
  eventId: string | null;
  paymentId: string | null;
  signatureValid: boolean;
  payload: unknown;
  error: string | null;
  status: 'RECEIVED' | 'PROCESSED' | 'FAILED';
}): Promise<string> {
  const eventId = input.eventId ?? `anon_${randomUUID()}`;
  const row = await db.webhookEvent.create({
    data: {
      provider: input.provider,
      eventId,
      paymentId: input.paymentId ?? undefined,
      status: input.status,
      signatureValid: input.signatureValid,
      payload: input.payload as never,
      processingError: input.error,
    } as never,
    select: { id: true },
  });
  return row.id;
}

/**
 * Точка входа webhook. НИКОГДА не бросает DomainError наружу — обработчик
 * роутов обязан отвечать 200 (дедупликация) или максимум 400 (подпись).
 * Любой внутренний сбой логируется и отвечает 200, чтобы провайдер не
 * ретраил вечно и не заспамил двойными событиями.
 */
export async function processWebhookPayment(input: ProcessWebhookInput): Promise<{ httpStatus: 200 | 400; body: string }> {
  const headers = toHeadersRecord(input.headers);

  // 1. Проверка подписи (кроме mock)
  let signatureValid = false;
  if (input.provider === 'mock') {
    signatureValid = true;
  } else {
    const secret = providerSecret(input.provider);
    const headerName = webhookSecurity.signatureHeaders[input.provider as keyof typeof webhookSecurity.signatureHeaders];
    const signature = headerName ? (headers[headerName.toLowerCase()] ?? null) : null;
    // Пробуем timestamp-схему, иначе body-only
    const ts = verifyTimestampedSignature(input.rawBody, signature, secret ?? '');
    if (ts.valid) signatureValid = true;
    else if (ts.reason === 'MALFORMED_HEADER' || ts.reason === 'MISSING_INPUT') {
      signatureValid = verifyBodySignature(input.rawBody, signature, secret ?? '');
    }
    // STALE/MISMATCH — подпись не сошлась
    if (!signatureValid) {
      await persistWebhookEvent({
        provider: input.provider,
        eventId: null,
        paymentId: null,
        signatureValid: false,
        payload: (() => { try { return JSON.parse(input.rawBody); } catch { return { raw: input.rawBody.slice(0, 4000) }; } })(),
        error: `signature ${ts.valid ? 'internal' : ts.reason ?? 'MISMATCH'}`,
        status: 'FAILED',
      });
      return { httpStatus: 400, body: 'invalid signature' };
    }
  }

  // 2. Разбор через провайдер (не доверяем телу от клиента — только после подписи)
  const provider = getPaymentProvider(input.provider);
  let event: Awaited<ReturnType<typeof provider.parseWebhook>>;
  try {
    event = await provider.parseWebhook({ rawBody: input.rawBody, headers });
  } catch (error) {
    const err = errorMessageOf(error);
    await persistWebhookEvent({
      provider: input.provider,
      eventId: null,
      paymentId: null,
      signatureValid: true,
      payload: (() => { try { return JSON.parse(input.rawBody); } catch { return { raw: input.rawBody.slice(0, 4000) }; } })(),
      error: `parse: ${err}`,
      status: 'FAILED',
    });
    // НИКОГДА не 500 — иначе провайдер будет ретраить вечно.
    return { httpStatus: 200, body: 'parse error logged' };
  }

  // 3. Дедупликация по (provider, eventId) — уникальность в БД
  const existing = await db.webhookEvent.findFirst({ where: { provider: input.provider, eventId: event.eventId } as never, select: { id: true } });
  if (existing) {
    // Идемпотентность: повтор без побочного эффекта.
    return { httpStatus: 200, body: 'duplicate' };
  }

  // Находим платёж по providerTransactionId
  const payment = await db.payment.findFirst({ where: { providerTransactionId: event.providerTransactionId } as never, select: { id: true, status: true, orderId: true, bookingId: true } as never }) as { id: string; status: string; orderId: string | null; bookingId: string | null } | null;

  const webhookId = await persistWebhookEvent({
    provider: input.provider,
    eventId: event.eventId,
    paymentId: payment?.id ?? null,
    signatureValid: true,
    payload: event.raw as unknown,
    error: null,
    status: 'RECEIVED',
  });

  // 4. Сверка: подтверждение только после getPayment() — 5.3
  let confirmedStatus = event.status;
  let paidAmount = event.amount as unknown as number;
  try {
    const snapshot = await provider.getPayment(event.providerTransactionId);
    confirmedStatus = snapshot.status;
    paidAmount = snapshot.paidAmount as unknown as number;
    await db.webhookEvent.update({ where: { id: webhookId }, data: { status: 'PROCESSED', processedAt: new Date() } as never });
  } catch (error) {
    const err = errorMessageOf(error);
    await db.webhookEvent.update({ where: { id: webhookId }, data: { status: 'FAILED', processingError: `getPayment: ${err}` } as never });
    return { httpStatus: 200, body: 'verification failed, logged' };
  }

  // 5. Применяем к платежу и к брони/заказу
  if (payment) {
    const paid = confirmedStatus === 'PAID' || confirmedStatus === 'AUTHORIZED';
    const failed = confirmedStatus === 'FAILED' || confirmedStatus === 'CANCELLED';
    await db.payment.update({
      where: { id: payment.id },
      data: {
        status: confirmedStatus as never,
        paidAmount: paid ? (paidAmount as number) : (payment.status === 'PAID' ? undefined : 0),
        ...(paid ? { paidAt: new Date() } : {}),
        ...(failed ? { failedAt: new Date(), failureCode: confirmedStatus, failureMessage: `verified ${confirmedStatus}` } : {}),
        providerPayload: event.raw as never,
      } as never,
    });

    if (paid) {
      if (payment.bookingId) {
        const b = await db.booking.findUnique({ where: { id: payment.bookingId }, select: { status: true } });
        if (b && ['PENDING', 'RESCHEDULED'].includes(b.status as string)) {
          await db.booking.update({ where: { id: payment.bookingId }, data: { status: 'CONFIRMED' } as never });
          await recordAudit({ actor: null, action: 'payment.confirmed', entityType: 'Booking', entityId: payment.bookingId });
        }
      }
      if (payment.orderId) {
        const o = await db.order.findUnique({ where: { id: payment.orderId }, select: { status: true } });
        if (o && o.status === 'CREATED') {
          await db.order.update({ where: { id: payment.orderId }, data: { status: 'PAID', paidAt: new Date() } as never });
          await recordAudit({ actor: null, action: 'payment.confirmed', entityType: 'Order', entityId: payment.orderId });
        }
      }
    }
  }

  return { httpStatus: 200, body: 'ok' };
}

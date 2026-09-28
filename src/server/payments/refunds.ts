/**
 * REFUNDS — 5.4 Возвраты: частичные, идемпотентность.
 *
 * • Сумма возврата проверяется против already-refunded (Refund сумма по Payment).
 * • Идемпотентность: повтор с тем же idempotencyKey возвращает существующий Refund, не бьёт провайдера второй раз.
 * • Провайдеру передаётся тот же idempotencyKey — двойной запрос не создаёт две выплаты.
 */

import 'server-only';

import { randomUUID } from 'node:crypto';

import { domainErrors } from '@/domain/errors';
import { db } from '@/lib/db';
import { getPaymentProvider, type PaymentProviderId } from '@/lib/payments';
import { recordAudit } from '@/lib/audit';
import type { Caller } from '@/lib/auth/guards';

export interface CreateRefundInput {
  paymentId: string;
  amount: number; // в минорных единицах, как Payment.amount
  reason: string;
  actor: Caller | null;
  idempotencyKey?: string;
}

export async function createRefund(input: CreateRefundInput) {
  const key = input.idempotencyKey ?? `refund_${input.paymentId}_${input.amount}_${randomUUID()}`;

  // Идемпотентность по ключу нашего Refund.
  const byKey = (await db.refund.findUnique({ where: { idempotencyKey: key } })) as unknown as { id: string; status: string } | null;
  if (byKey) return byKey;

  const payment = (await db.payment.findUnique({ where: { id: input.paymentId } })) as unknown as { id: string; provider: string; providerTransactionId: string | null; status: string; amount: number; currencyCode: string } | null;
  if (!payment || !payment.providerTransactionId) throw domainErrors.notFound();
  if (!['PAID', 'AUTHORIZED', 'PARTIALLY_REFUNDED'].includes(payment.status)) throw domainErrors.refundNotAllowed();

  const existingRefunds = (await db.refund.findMany({ where: { paymentId: payment.id } })) as unknown as Array<{ amount: number; status: string }>;
  const refunded = existingRefunds.filter((r) => r.status !== 'FAILED').reduce((s, r) => s + r.amount, 0);
  if (refunded + input.amount > payment.amount) throw domainErrors.refundNotAllowed();
  if (input.amount <= 0) throw domainErrors.validationFailed('amount');

  const provider = getPaymentProvider(payment.provider as PaymentProviderId);
  if (!provider.supportsPartialRefund && refunded + input.amount !== payment.amount) {
    throw domainErrors.refundNotAllowed();
  }

  // Резервируем строку, чтобы повтор не создал вторую.
  let refund: { id: string; status: string } = (await db.refund.create({
    data: {
      paymentId: payment.id,
      orderId: null,
      amount: input.amount,
      reason: input.reason,
      status: 'PENDING' as never,
      idempotencyKey: key,
      initiatedBy: input.actor?.id ?? null,
    } as never,
    select: { id: true, status: true },
  })) as unknown as { id: string; status: string };

  try {
    const result = await provider.refund({
      providerTransactionId: payment.providerTransactionId,
      amount: input.amount as never,
      reason: input.reason,
      idempotencyKey: key,
    });

    const nextStatus = result.status === 'REFUNDED' || result.status === 'PARTIALLY_REFUNDED' ? result.status : 'PENDING';
    refund = (await db.refund.update({
      where: { id: refund.id },
      data: {
        status: nextStatus as never,
        providerRefundId: result.providerRefundId,
        providerPayload: result.raw as never,
        ...(nextStatus !== 'PENDING' ? { completedAt: new Date() } : {}),
      } as never,
      select: { id: true, status: true },
    })) as unknown as { id: string; status: string };

    // Синхронизируем статус платежа
    if (nextStatus === 'REFUNDED') {
      await db.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } as never });
    } else if (nextStatus === 'PARTIALLY_REFUNDED') {
      await db.payment.update({ where: { id: payment.id }, data: { status: 'PARTIALLY_REFUNDED' } as never });
    }

    await recordAudit({ actor: input.actor, action: 'payment.refund', entityType: 'Payment', entityId: payment.id, after: { refundId: refund.id, amount: input.amount } });
  } catch (error) {
    await db.refund.update({ where: { id: refund.id }, data: { status: 'FAILED' as never, providerPayload: { error: String((error as { message?: unknown })?.message ?? error) } as never } as never });
    throw domainErrors.paymentFailed(error);
  }

  return refund;
}

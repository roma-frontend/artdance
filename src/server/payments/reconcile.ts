/**
 * RECONCILE — 5.3 ручная/фоновая сверка платежей.
 *
 * Одноразовая проверка подвешенных PENDING против getPayment() — для
 * страницы возврата и для крона. Никогда не подтверждает редирект напрямую.
 */

import 'server-only';

import { db } from '@/lib/db';
import { getPaymentProvider, type PaymentProviderId } from '@/lib/payments';
import { recordAudit } from '@/lib/audit';
import type { PaymentStatus } from '@/domain/enums';

function isTerminal(status: string): boolean {
  return ['REFUNDED', 'CANCELLED', 'CHARGEBACK'].includes(status);
}

export interface ReconcileInput {
  /** pay_\w+ из Payment.providerTransactionId или paymentId (cuid) */
  paymentId: string;
  expectedProvider?: PaymentProviderId;
}

export async function reconcilePayment(input: ReconcileInput) {
  const payment =
    ((await db.payment.findUnique({ where: { id: input.paymentId } })) as unknown as { id: string; provider: string; providerTransactionId: string | null; status: string; orderId: string | null; bookingId: string | null } | null) ??
    ((await db.payment.findFirst({ where: { providerTransactionId: input.paymentId } }) as unknown as { id: string; provider: string; providerTransactionId: string | null; status: string; orderId: string | null; bookingId: string | null } | null));
  if (!payment || !payment.providerTransactionId) return { status: 'NOT_FOUND' as const };

  if (isTerminal(payment.status)) return { status: payment.status as PaymentStatus };

  const provider = getPaymentProvider(payment.provider as PaymentProviderId);
  const snapshot = await provider.getPayment(payment.providerTransactionId);

  const paid = snapshot.status === 'PAID' || snapshot.status === 'AUTHORIZED';
  const failed = snapshot.status === 'FAILED' || snapshot.status === 'CANCELLED';

  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: snapshot.status as never,
      paidAmount: snapshot.paidAmount as unknown as number,
      ...(paid ? { paidAt: new Date() } : {}),
      ...(failed ? { failedAt: new Date(), failureCode: snapshot.failureCode ?? snapshot.status, failureMessage: snapshot.failureMessage ?? null } : {}),
      providerPayload: snapshot.raw as never,
    } as never,
  });

  if (paid) {
    if (payment.bookingId) {
      const b = await db.booking.findUnique({ where: { id: payment.bookingId }, select: { status: true } });
      if (b && ['PENDING', 'RESCHEDULED'].includes(b.status as string)) {
        await db.booking.update({ where: { id: payment.bookingId }, data: { status: 'CONFIRMED' } as never });
        await recordAudit({ actor: null, action: 'payment.reconciled', entityType: 'Booking', entityId: payment.bookingId });
      }
    }
    if (payment.orderId) {
      const o = await db.order.findUnique({ where: { id: payment.orderId }, select: { status: true } });
      if (o && o.status === 'CREATED') {
        await db.order.update({ where: { id: payment.orderId }, data: { status: 'PAID', paidAt: new Date() } as never });
        await recordAudit({ actor: null, action: 'payment.reconciled', entityType: 'Order', entityId: payment.orderId });
      }
    }
  }

  return { status: snapshot.status, paidAmount: snapshot.paidAmount };
}

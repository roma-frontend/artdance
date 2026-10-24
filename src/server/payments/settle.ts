/**
 * SETTLE — «оплата подтверждена, теперь достави то, что купили».
 *
 * Отдельный шаг, а не условие внутри вебхука: подтверждение оплаты приходит от
 * провайдера (или из сверки), а выдача пакета, активация подписки, запись
 * комиссии и реферальный бонус — наша работа, и между ними может случиться сбой.
 * Поэтому переход «оплачен → доставлен» живёт отдельно и помечается на заказе
 * (`settledAt`), а не выводится из статуса платежа.
 *
 * Идемпотентность двух уровней:
 *  • Заявка: `settledAt` ставится первым `UPDATE` с условием `IS NULL` —
 *    повторная доставка вебхука проигрывает гонку и не выдаёт второй пакет.
 *  • Эффекты: пакет — по уникальному `purchaseKey`, кошелёк — по `WalletEntry.refId`,
 *    запись комиссии — по уникальному `orderItemId`, подписка — по повторной
 *    проверке активной. Даже если заявка потеряется, деньги не задвоятся.
 *
 * При сбое заявка снимается: иначе заказ навсегда остался бы «оплачен и
 * недоставлен», а повторная попытка была бы невозможна.
 */

import 'server-only';

import { payout } from '@/config/business';
import { commissionableLineItems, subscriptionPlans, type SubscriptionPlanId } from '@/config/pricing';
import { splitCommission } from '@/domain/money';
import type { LineItemType } from '@/generated/prisma/client';
import { recordAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { purchaseClassPass } from '@/server/class-pass/service';
import { payReferralBonus } from '@/server/referral/service';
import { creditWallet } from '@/server/wallet/service';

export interface SettleResult {
  settled: boolean;
  effects: readonly string[];
}

const DAY_MS = 86_400_000;

function metadataOf(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

/** Сколько живёт активная подписка с момента оплаты. */
function periodEnd(now: Date, interval: 'MONTHLY' | 'YEARLY'): Date {
  const end = new Date(now);
  if (interval === 'YEARLY') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

async function deliver(orderId: string, now: Date): Promise<string[]> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      items: {
        select: {
          id: true,
          type: true,
          unitPrice: true,
          lineTotal: true,
          metadata: true,
          commission: { select: { id: true } },
        },
      },
    },
  });
  if (!order) return [];

  const effects: string[] = [];
  const userId = order.userId;

  for (const item of order.items) {
    const meta = metadataOf(item.metadata);

    if (userId && item.type === 'CLASS_PASS') {
      const passId = typeof meta.passId === 'string' ? meta.passId : null;
      if (passId) {
        await purchaseClassPass({ userId, passId, idempotencyKey: `classpass:${order.id}`, now, deliverOnly: true });
        effects.push('classPass');
      }
    }

    if (userId && item.type === 'WALLET_TOPUP') {
      await creditWallet({
        userId,
        amount: item.lineTotal,
        kind: 'CREDIT_TOPUP',
        refId: `wallet:${order.id}`,
      });
      effects.push('wallet.topup');
    }

    if (userId && item.type === 'SUBSCRIPTION') {
      const planId = typeof meta.planId === 'string' ? meta.planId : null;
      const interval = meta.interval === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
      if (planId && planId in subscriptionPlans) {
        const plan = subscriptionPlans[planId as SubscriptionPlanId];
        const existing = await db.subscription.findFirst({
          where: { userId, planId, status: { in: ['ACTIVE', 'TRIALING'] } },
          select: { id: true },
        });
        if (!existing) {
          await db.subscription.create({
            data: {
              userId,
              planId,
              interval,
              status: 'ACTIVE',
              priceSnapshot: item.unitPrice,
              currentPeriodStart: now,
              currentPeriodEnd: periodEnd(now, interval),
              trialEndsAt: plan.trialDays > 0 ? new Date(now.getTime() + plan.trialDays * DAY_MS) : null,
            },
            select: { id: true },
          });
          effects.push('subscription');
        }
      }
    }

    if (userId && item.type === 'COURSE_ENROLLMENT') {
      const courseId = typeof meta.courseId === 'string' ? meta.courseId : null;
      if (courseId) {
        /* `@@unique([courseId, userId])` — повторная доставка не создаёт вторую запись. */
        await db.courseEnrollment.upsert({
          where: { courseId_userId: { courseId, userId } },
          create: { courseId, userId, orderId: order.id, startedAt: now },
          update: {},
          select: { id: true },
        });
        effects.push('enrollment');
      }
    }

    /*
     * Комиссия платформы. Считается по линии заказа, а не по брони: аренда зала
     * и продажа билета живут только здесь, а у `orderItemId` уникальный индекс —
     * повторная доставка упирается в него, если запись уже поставлена.
     */
    if (commissionableLineItems.includes(item.type as LineItemType) && !item.commission) {
      const split = splitCommission(item.lineTotal, item.type as LineItemType);
      if (split.platformFee > 0) {
        /*
         * Гонку закрывает уникальный `orderItemId`, а не проверка выше: между
         * чтением и записью успевает другая доставка. Выигравший уже записал
         * комиссию — это не сбой, и заказ не должен остаться недоставленным
         * из-за того, что соседний обработчик оказался быстрее.
         */
        const created = await db.commissionRecord
          .create({
            data: {
              orderItemId: item.id,
              instructorId: typeof meta.instructorId === 'string' ? meta.instructorId : null,
              venueId: typeof meta.venueId === 'string' ? meta.venueId : null,
              grossAmount: split.gross,
              rate: split.rate,
              platformFee: split.platformFee,
              providerNet: split.providerNet,
              releaseAt: new Date(now.getTime() + payout.holdbackDays * DAY_MS),
            },
            select: { id: true },
          })
          .catch((error: unknown) => {
            if ((error as { code?: string })?.code === 'P2002') return null;
            throw error;
          });
        if (created) effects.push('commission');
      }
    }
  }

  /*
   * Реферальный бонус — первой оплаченной покупкой реферала. Ошибка здесь не
   * должна блокировать доставку остального: бонус можно доплатить вручную, а
   * пакет, за который человек уже заплатил, — нет.
   */
  if (userId) {
    try {
      const referral = await db.referral.findFirst({
        where: { refereeId: userId, bonusPaidAt: null },
        select: { id: true },
      });
      if (referral) {
        await payReferralBonus(referral.id, { deliverOnly: true });
        effects.push('referral');
      }
    } catch (error) {
      console.warn('[settle] referral bonus not paid', error);
    }
  }

  return effects;
}

/**
 * Доставляет оплаченный заказ. Вызывается из вебхука и из сверки платежей.
 *
 * Повторный вызов — no-op: он отвечает `{ settled: false }`, а не выдаёт вторую
 * порцию того же самого.
 */
/* COD оплачивается при получении, поэтому заказ может уже стоять в сборке или доставке. */
const SETTLEABLE_STATUSES = ['PAID', 'PACKING', 'SHIPPED', 'DELIVERED'] as const;

export async function settlePaidOrder(orderId: string, now: Date = new Date()): Promise<SettleResult> {
  const claimed = await db.order.updateMany({
    where: { id: orderId, status: { in: [...SETTLEABLE_STATUSES] }, settledAt: null },
    data: { settledAt: now },
  });
  if (claimed.count !== 1) return { settled: false, effects: [] };

  try {
    const effects = await deliver(orderId, now);
    await recordAudit({
      actor: null,
      action: 'order.settled',
      entityType: 'Order',
      entityId: orderId,
      after: { effects },
    });
    return { settled: true, effects };
  } catch (error) {
    /*
     * Снимаем отметку доставленного: заказ остаётся оплаченным и доставляемым,
     * а не «оплаченным и потерянным». Повторная доставка возможна сразу.
     */
    await db.order
      .updateMany({ where: { id: orderId, settledAt: { not: null } }, data: { settledAt: null } })
      .catch(() => null);
    console.error('[settle] delivery failed, mark for retry', error);
    throw error;
  }
}

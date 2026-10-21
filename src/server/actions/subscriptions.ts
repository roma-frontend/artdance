/**
 * ПОДПИСКА — покупка плана клиентом платформы.
 *
 * Кнопка «Выбрать» на `/pricing` вела на `/contact`: витрина была, покупки нет.
 * Теперь план покупается тем же путём, что пакет и товар — заказ
 * (`SUBSCRIPTION`) → провайдер → `settle`, где создаётся активная подписка.
 *
 * Здесь нет ни расчёта периода, ни активации: это делает `settle` после
 * подтверждения оплаты. Иначе подписка появлялась бы в момент нажатия кнопки,
 * то есть бесплатно.
 */

'use server';

import { z } from 'zod';

import { domainErrors } from '@/domain/errors';
import { subscriptionPlanNameKey, subscriptionPlans, type SubscriptionPlanId } from '@/config/pricing';
import { translateForSnapshot } from '@/i18n/snapshot';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { createDirectOrder } from '@/server/orders/service';
import { authedAction } from '@/server/safe-action';

const planIds = Object.keys(subscriptionPlans) as [string, ...string[]];
const intervals = ['MONTHLY', 'YEARLY'] as const;

export const purchaseSubscriptionAction = authedAction
  .metadata({ rateLimit: 'paymentIntent', audit: 'subscription.purchase' })
  .inputSchema(z.object({ planId: z.enum(planIds), interval: z.enum(intervals) }))
  .action(async ({ parsedInput, ctx }) => {
    /*
     * Тумблер `subscriptions` — первый: при MVP/FULL подписка не продаётся, и
     * выключенный модуль не должен оставить в базе заказ, который никогда не
     * доставится.
     */
    await assertEntitlementOrThrow('subscriptions');

    const plan = subscriptionPlans[parsedInput.planId as SubscriptionPlanId];
    if (!plan) throw domainErrors.notFound();

    /* Цена — из конфигурации плана, а не из запроса. */
    const price = plan.price[parsedInput.interval];
    const caller = ctx.caller;

    /*
     * Название в заказе — переведённое, а не ключ: `OrderItem.titleSnapshot`
     * читают в письмах, счёте и админке, где каталога переводов нет.
     */
    const title = translateForSnapshot(caller.locale, subscriptionPlanNameKey(plan.id));

    const order = await createDirectOrder({
      userId: caller.id,
      contact: { email: caller.email, phone: '', name: caller.name || caller.email },
      lines: [
        {
          type: 'SUBSCRIPTION',
          title,
          unitPrice: price,
          metadata: { planId: plan.id, interval: parsedInput.interval },
        },
      ],
    });

    return { orderId: order.id, orderNumber: order.orderNumber, total: order.total };
  });

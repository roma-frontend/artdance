/**
 * ПОКУПКА ПАКЕТА ЗАНЯТИЙ.
 *
 * Пакет продаётся тем же путём, что и товар: `Order` → `Payment` → провайдер →
 * `settle`. Отдельный «быстрый» выпуск в обход оплаты означал бы второй кассовый
 * контур, то есть второй набор кода для возврата, сверки и идемпотентности —
 * именно то, из-за чего пакеты и не продавались.
 *
 * Здесь только заказ: `settle` выпускает сам пакет, когда оплата подтверждена
 * (см. `payments/settle.ts`, ветка `CLASS_PASS`). Поэтому в ответе — номер
 * заказа, а не пакет: пакета ещё нет, и обещать его до оплаты нельзя.
 *
 * Тумблер `packages` проверяется до чтения каталога: выключенный модуль не
 * должен успеть создать даже черновик заказа.
 */

'use server';

import { z } from 'zod';

import { classPasses, classPassById, priceGuidance } from '@/config/pricing';
import { translateForSnapshot } from '@/i18n/snapshot';
import { classPassOfferPrice } from '@/domain/class-pass';
import { domainErrors } from '@/domain/errors';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { createDirectOrder } from '@/server/orders/service';
import { authedAction } from '@/server/safe-action';

const passIds = classPasses.map((pass) => pass.id) as [string, ...string[]];

/** Цена пакета — из каталога, а не из запроса: клиент присылает только `passId`. */
function priceOf(passId: string): { lessons: number; price: number } {
  const offer = classPassById(passId);
  if (!offer) throw domainErrors.notFound();
  const perLesson = classPassOfferPrice(priceGuidance.groupClass.typical, offer.discountRate, offer.lessons);
  return {
    lessons: offer.lessons,
    price: perLesson * offer.lessons,
  };
}

export const purchaseClassPassAction = authedAction
  .metadata({ rateLimit: 'paymentIntent', audit: 'classPass.purchase' })
  .inputSchema(z.object({ passId: z.enum(passIds) }))
  .action(async ({ parsedInput, ctx }) => {
    await assertEntitlementOrThrow('packages');

    const { lessons, price } = priceOf(parsedInput.passId);
    const caller = ctx.caller;

    /*
     * Название в заказе — переведённое и с числом занятий: `titleSnapshot`
     * читают в счёте и письме, где нет ни каталога переводов, ни конфигурации.
     * `translateForSnapshot`, а не `getTranslations`: действие не должно
     * зависеть от контекста запроса, чтобы его можно было вызвать и из теста,
     * и из задачи по расписанию.
     */
    const title = translateForSnapshot(caller.locale, 'pricing.classPasses.lessonsCount', { count: lessons });

    /*
     * Контакты для заказа берутся из аккаунта, а не из формы: пакет покупает
     * тот, кто вошёл, и лишний набор полей здесь означал бы, что сумму можно
     * оформить на чужой адрес.
     */
    const order = await createDirectOrder({
      userId: caller.id,
      contact: { email: caller.email, phone: '', name: caller.name || caller.email },
      lines: [
        {
          type: 'CLASS_PASS',
          title,
          unitPrice: price,
          metadata: { passId: parsedInput.passId, lessons },
        },
      ],
    });

    return { orderId: order.id, orderNumber: order.orderNumber, total: order.total };
  });

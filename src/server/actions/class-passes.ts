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

import { authedAction } from '@/server/safe-action';
import { classPassIds, createClassPassOrder } from '@/server/class-pass/order';

export const purchaseClassPassAction = authedAction
  .metadata({ rateLimit: 'paymentIntent', audit: 'classPass.purchase' })
  .inputSchema(z.object({ passId: z.enum(classPassIds) }))
  .action(async ({ parsedInput, ctx }) => {
    const order = await createClassPassOrder(ctx.caller, parsedInput.passId);
    return { orderId: order.id, orderNumber: order.orderNumber, total: order.total };
  });

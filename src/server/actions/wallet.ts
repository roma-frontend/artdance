/**
 * ПОПОЛНЕНИЕ КОШЕЛЬКА.
 *
 * Пополнение — обычная покупка: заказ с линией `WALLET_TOPUP`, провайдер,
 * `settle` зачисляет баланс. Прямое зачисление «по кнопке» означало бы
 * бесплатные деньги; отдельный кассовый контур — второй набор кода возврата и
 * сверки.
 *
 * Сумма ограничена сверху и снизу. Потолок не про безопасность платежа
 * (провайдер всё равно спишет столько, сколько сказано), а про разбор споров:
 * случайное «100000000» в поле — это звонок в поддержку и ручной возврат, а не
 * покупка. Нижняя граница — 500 ֏, чтобы не гонять эквайринг на сумму меньше
 * комиссии.
 */

'use server';

import { z } from 'zod';

import { domainErrors } from '@/domain/errors';
import { translateForSnapshot } from '@/i18n/snapshot';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { createDirectOrder } from '@/server/orders/service';
import { authedAction } from '@/server/safe-action';

/** Пределы пополнения, драмы. */
export const walletTopUpLimits = { min: 500, max: 500_000 } as const;

/** Шаг кнопок пополнения — круглые суммы, а не любое число из поля. */
export const walletTopUpPresets = [5_000, 10_000, 25_000] as const;

export const topUpWalletAction = authedAction
  .metadata({ rateLimit: 'paymentIntent', audit: 'wallet.topup' })
  .inputSchema(
    z.object({
      amount: z
        .number()
        .int()
        .min(walletTopUpLimits.min)
        .max(walletTopUpLimits.max),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    /*
     * Тумблер спрашивается до создания заказа: выключенный кошелёк не должен
     * оставить оплаченный заказ, который некуда зачислить. В отличие от
     * зачисления уже оплаченного (`creditWallet` с `CREDIT_TOPUP`), здесь речь
     * о новой покупке — она подчиняется тарифу.
     */
    await assertEntitlementOrThrow('wallet');

    const caller = ctx.caller;
    const amount = parsedInput.amount;
    if (!Number.isSafeInteger(amount)) throw domainErrors.validationFailed('amount');

    /* Название в заказе — переведённое: счёт и письмо не читают каталог переводов. */
    const title = translateForSnapshot(caller.locale, 'account.walletScreen.topUpTitle');

    const order = await createDirectOrder({
      userId: caller.id,
      contact: { email: caller.email, phone: '', name: caller.name || caller.email },
      lines: [
        {
          type: 'WALLET_TOPUP',
          title,
          unitPrice: amount,
          metadata: { amount },
        },
      ],
    });

    return { orderId: order.id, orderNumber: order.orderNumber, total: order.total };
  });

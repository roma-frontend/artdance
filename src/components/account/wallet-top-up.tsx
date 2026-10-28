/**
 * ПОПОЛНЕНИЕ КОШЕЛЬКА — кнопки-суммы, а не поле ввода.
 *
 * Поле «введите сумму» на этом экране приглашает к опечатке на порядок, а
 * разбор такой опечатки — звонок в поддержку и ручной возврат. Три круглые
 * суммы покрывают реальные случаи; произвольная сумма остаётся в действии
 * (`walletTopUpLimits`), но не в кнопке.
 *
 * Пополнение идёт тем же путём, что любая покупка: заказ → `intent` → провайдер.
 * Успеха здесь не бывает — после оплаты человек попадает на страницу возврата,
 * где статус берётся из базы.
 */

'use client';

import { Loader2Icon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { useInAppPayment } from '@/components/payments/in-app-payment';
import { Button } from '@/components/ui/button';
import { routes } from '@/config/routes';
import { paymentMethods } from '@/domain/enums';
import type { MessageKey } from '@/i18n/types';
import { useRouter } from '@/i18n/routing';
import { toActionMessageKey } from '@/lib/payments/action-message';
import { createPaymentIntent } from '@/lib/payments/api';
import { topUpWalletAction } from '@/server/actions/wallet';

export function WalletTopUp({ presets }: { presets: readonly number[] }) {
  const t = useTranslations('account.walletScreen');
  const tRoot = useTranslations();
  const format = useFormatter();
  const router = useRouter();

  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const { pay } = useInAppPayment();
  /* Заказ создаётся один раз на сумму: повтор после закрытия листа идёт по нему, другая сумма — новый заказ. */
  const pendingOrder = useRef<{ amount: number; orderId: string; orderNumber: string } | null>(null);

  const topUp = async (amount: number) => {
    setPendingAmount(amount);
    setError(null);
    try {
      let order = pendingOrder.current;
      if (!order || order.amount !== amount) {
        const created = await topUpWalletAction({ amount });
        if (created?.serverError) {
          setError(toActionMessageKey(created.serverError.messageKey));
          return;
        }
        if (!created?.data?.orderId) {
          setError('errors.generic.description');
          return;
        }
        order = { amount, orderId: created.data.orderId, orderNumber: created.data.orderNumber };
        pendingOrder.current = order;
      }

      const { orderId, orderNumber } = order;
      const method = paymentMethods[0] ?? 'CARD';
      const outcome = await pay({
        method,
        start: () => createPaymentIntent({ orderId, method }),
        onComplete: () => router.push(routes.checkoutResult(orderNumber)),
      });
      if (!outcome.ok) setError(outcome.messageKey);
    } catch {
      setError('errors.generic.description');
    } finally {
      setPendingAmount(null);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {presets.map((amount) => (
          <Button
            key={amount}
            type="button"
            variant="outline"
            disabled={pendingAmount !== null}
            aria-busy={pendingAmount === amount}
            onClick={() => void topUp(amount)}
          >
            {pendingAmount === amount ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
            {t('topUpCta', { amount: format.number(amount, 'price') })}
          </Button>
        ))}
      </div>
      <p className="text-caption text-content-tertiary">{t('topUpHint')}</p>
      {error ? (
        <p role="alert" className="text-caption font-semibold text-content-danger">
          {tRoot(error)}
        </p>
      ) : null}
    </div>
  );
}

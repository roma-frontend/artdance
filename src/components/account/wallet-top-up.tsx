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
import { useState } from 'react';

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

  const topUp = async (amount: number) => {
    setPendingAmount(amount);
    setError(null);
    try {
      const order = await topUpWalletAction({ amount });
      if (order?.serverError) {
        setError(toActionMessageKey(order.serverError.messageKey));
        return;
      }
      if (!order?.data?.orderId) {
        setError('errors.generic.description');
        return;
      }

      const intent = await createPaymentIntent({ orderId: order.data.orderId, method: paymentMethods[0] ?? 'CARD' });
      if (!intent.ok) {
        setError(intent.error.messageKey);
        return;
      }

      if (intent.data.redirectUrl) {
        window.location.assign(intent.data.redirectUrl);
        return;
      }
      router.push(routes.checkoutResult(order.data.orderNumber));
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

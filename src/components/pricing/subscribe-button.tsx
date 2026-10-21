/**
 * КНОПКА «ВЫБРАТЬ ПЛАН».
 *
 * Покупка подписки — тот же контур, что у пакета и товара: заказ
 * (`SUBSCRIPTION`) → провайдер → `settle` создаёт активную подписку. Успеха
 * здесь не рисуем: после оплаты человек попадает на страницу возврата, а
 * подписка появляется только после подтверждения.
 *
 * Гость видит ссылку на вход: подписка привязана к аккаунту, и купить её
 * «на кого-нибудь» нельзя.
 */

'use client';

import { Loader2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { routes } from '@/config/routes';
import { paymentMethods, type PaymentMethod } from '@/domain/enums';
import type { MessageKey } from '@/i18n/types';
import { Link, useRouter } from '@/i18n/routing';
import { toActionMessageKey } from '@/lib/payments/action-message';
import { createPaymentIntent } from '@/lib/payments/api';
import type { SubscriptionPlanId } from '@/config/pricing';
import { purchaseSubscriptionAction } from '@/server/actions/subscriptions';

interface SubscribeButtonProps {
  planId: SubscriptionPlanId;
  interval: 'MONTHLY' | 'YEARLY';
  planName: string;
  label: string;
  variant: 'accent' | 'outline';
  /** Есть ли сессия. Гость получает ссылку на вход вместо кнопки покупки. */
  signedIn: boolean;
  /** Метод оплаты по умолчанию — первый доступный у провайдера. */
  method?: PaymentMethod;
}

export function SubscribeButton({
  planId,
  interval,
  planName,
  label,
  variant,
  signedIn,
  method = paymentMethods[0] ?? 'CARD',
}: SubscribeButtonProps) {
  const t = useTranslations();
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);

  if (!signedIn) {
    return (
      <Button asChild block className="mt-8" variant={variant}>
        <Link href={routes.signIn(routes.pricing())} aria-label={`${label} — ${t('errors.unauthorized.title')}`}>
          {label}
        </Link>
      </Button>
    );
  }

  const buy = async () => {
    setPending(true);
    setError(null);
    try {
      const order = await purchaseSubscriptionAction({ planId, interval });
      if (order?.serverError) {
        setError(toActionMessageKey(order.serverError.messageKey));
        return;
      }
      if (!order?.data?.orderId) {
        setError('errors.generic.description');
        return;
      }

      const intent = await createPaymentIntent({ orderId: order.data.orderId, method });
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
      setPending(false);
    }
  };

  return (
    <div className="mt-8 flex flex-col gap-2">
      <Button
        type="button"
        block
        variant={variant}
        disabled={pending}
        aria-busy={pending}
        aria-label={`${label} — ${planName}`}
        onClick={() => void buy()}
      >
        {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
        {label}
      </Button>
      {error ? (
        <p role="alert" className="text-caption font-semibold text-content-danger">
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}

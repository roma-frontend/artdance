/**
 * КНОПКА ПОКУПКИ ПАКЕТА.
 *
 * Пакет продаётся через тот же платёжный контур, что и товар: действие создаёт
 * заказ, `intent` отправляет его провайдеру, редирект ведёт на оплату. Поэтому
 * кнопка не рисует «куплено» — после создания заказа и платежа она открывает
 * страницу возврата, где статус берётся из базы.
 *
 * **Два состояния, и разница между ними видна.** Вошедший видит кнопку; гость
 * видит ссылку на вход — пакет привязан к аккаунту (`ClassPass.purchaserId`),
 * и покупать его гостю некуда. Прятать кнопку целиком было бы хуже: человек не
 * понял бы, почему купить нельзя.
 *
 * `paymentsEnabled` приходит с сервера: провайдер может быть не настроен, и
 * тогда «выключенный» вид кнопки — правда, а не заглушка.
 */

'use client';

import { Loader2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { useInAppPayment } from '@/components/payments/in-app-payment';
import { Button } from '@/components/ui/button';
import { routes } from '@/config/routes';
import { paymentMethods } from '@/domain/enums';
import type { MessageKey } from '@/i18n/types';
import { Link, useRouter } from '@/i18n/routing';
import { createPaymentIntent } from '@/lib/payments/api';
import { toActionMessageKey } from '@/lib/payments/action-message';
import { purchaseClassPassAction } from '@/server/actions/class-passes';

interface ClassPassPurchaseFormProps {
  passId: string;
  /** Подпись «N занятий» — переводится на сервере, кнопка её только показывает. */
  label: string;
  /** Есть ли сессия. Гость получает ссылку на вход. */
  signedIn: boolean;
  /** Настроен ли платёжный провайдер (`availablePaymentMethods().length > 0`). */
  paymentsEnabled: boolean;
}

export function ClassPassPurchaseForm({ passId, label, signedIn, paymentsEnabled }: ClassPassPurchaseFormProps) {
  const t = useTranslations('pricing');
  const tRoot = useTranslations();
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const { pay } = useInAppPayment();
  /* Заказ пакета создаётся один раз: повтор после закрытия листа оплаты идёт по нему. */
  const pendingOrder = useRef<{ orderId: string; orderNumber: string } | null>(null);

  if (!paymentsEnabled) {
    return <p className="text-caption mt-6 text-content-tertiary">{t('classPasses.unavailable')}</p>;
  }

  if (!signedIn) {
    return (
      <Button asChild variant="outline" className="mt-6 w-full">
        <Link href={routes.signIn(routes.pricing())}>{tRoot('errors.unauthorized.title')}</Link>
      </Button>
    );
  }

  const buy = async () => {
    setPending(true);
    setError(null);
    try {
      let order = pendingOrder.current;
      if (!order) {
        const created = await purchaseClassPassAction({ passId });
        if (created?.serverError) {
          setError(toActionMessageKey(created.serverError.messageKey));
          return;
        }
        if (!created?.data?.orderId) {
          setError('errors.generic.description');
          return;
        }
        order = { orderId: created.data.orderId, orderNumber: created.data.orderNumber };
        pendingOrder.current = order;
      }

      const { orderId, orderNumber } = order;
      /* Пакет — цифровая покупка: карта это единственный способ, который есть у всех провайдеров. */
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
      setPending(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-2">
      <Button
        type="button"
        variant="accent"
        className="w-full"
        disabled={pending}
        onClick={() => void buy()}
        aria-busy={pending}
      >
        {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
        {label}
      </Button>
      {error ? (
        <p role="alert" className="text-caption font-semibold text-content-danger">
          {tRoot(error)}
        </p>
      ) : null}
    </div>
  );
}

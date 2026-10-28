/**
 * ОПЛАТА БРОНИ — выбор способа и переход к провайдеру для PENDING-брони.
 *
 * Аренда зала и любая бронь без предоплаты ждут оплаты. Оплата идёт в листе
 * поверх страницы. Подтверждение приходит webhook'ом провайдера или сверкой:
 * после неё страница обновляется, и статус читается из базы.
 */

'use client';

import { Loader2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { PaymentMethodPicker } from '@/components/checkout/payment-method-picker';
import { useInAppPayment } from '@/components/payments/in-app-payment';
import { Button } from '@/components/ui/button';
import type { PaymentMethod } from '@/domain/enums';
import { useRouter } from '@/i18n/routing';
import { startBookingPayment } from '@/lib/payments/api';

interface BookingPayPanelProps {
  bookingId: string;
  /** Из `availablePaymentMethodsWithGlobal()`. Пустой список = оплата недоступна. */
  methods: readonly PaymentMethod[];
}

export function BookingPayPanel({ bookingId, methods }: BookingPayPanelProps) {
  const t = useTranslations('booking');
  const router = useRouter();
  const { pay: payInApp } = useInAppPayment();
  const [method, setMethod] = useState<PaymentMethod | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const pay = async () => {
    if (!method || pending) return;
    setPending(true);
    setFailed(false);
    try {
      const outcome = await payInApp({
        method,
        start: () => startBookingPayment({ bookingId, method }),
        onComplete: () => router.refresh(),
      });
      if (!outcome.ok) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid min-w-0 gap-4">
      <PaymentMethodPicker methods={methods} value={method} onChange={setMethod} failed={failed} />

      {failed ? (
        <p role="alert" className="text-body-sm font-semibold text-content-danger">
          {t('payError')}
        </p>
      ) : null}

      <Button
        type="button"
        variant="accent"
        size="lg"
        block
        disabled={!method || pending || methods.length === 0}
        aria-busy={pending}
        onClick={() => void pay()}
      >
        {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
        {t('payCta')}
      </Button>
    </div>
  );
}

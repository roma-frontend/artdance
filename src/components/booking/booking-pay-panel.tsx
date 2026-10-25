/**
 * ОПЛАТА БРОНИ — выбор способа и переход к провайдеру для PENDING-брони.
 *
 * Аренда зала и любая бронь без предоплаты ждут оплаты. Подтверждение приходит
 * webhook'ом провайдера, поэтому после редиректа здесь ничего не подтверждается:
 * статус читается из базы при следующей загрузке страницы.
 */

'use client';

import { Loader2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { PaymentMethodPicker } from '@/components/checkout/payment-method-picker';
import { Button } from '@/components/ui/button';
import { apiRoutes } from '@/config';
import type { PaymentMethod } from '@/domain/enums';
import { useRouter } from '@/i18n/routing';

interface BookingPayPanelProps {
  bookingId: string;
  /** Из `availablePaymentMethodsWithGlobal()`. Пустой список = оплата недоступна. */
  methods: readonly PaymentMethod[];
}

export function BookingPayPanel({ bookingId, methods }: BookingPayPanelProps) {
  const t = useTranslations('booking');
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const pay = async () => {
    if (!method || pending) return;
    setPending(true);
    setFailed(false);
    try {
      const res = await fetch(apiRoutes.bookingPay(bookingId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method }),
      });
      const body = (await res.json().catch(() => null)) as { redirectUrl?: string | null } | null;
      if (!res.ok) {
        setFailed(true);
        return;
      }
      if (body?.redirectUrl) {
        window.location.assign(body.redirectUrl);
        return;
      }
      router.refresh();
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

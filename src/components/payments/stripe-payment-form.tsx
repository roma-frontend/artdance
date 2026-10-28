'use client';

import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import {
  type Appearance,
  loadStripe,
  type Stripe,
  type StripeElementsOptions,
  type StripePaymentElementOptions,
} from '@stripe/stripe-js';
import { useTranslations } from 'next-intl';
import { type FormEvent, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { lightColors } from '@/design/tokens';
import type { MessageKey } from '@/i18n/types';

/** Цвет кнопок и фокуса в форме Stripe: бренд сайта (роль accent), а не синий по умолчанию. */
const APPEARANCE: Appearance = {
  theme: 'stripe',
  variables: { colorPrimary: lightColors.accent, borderRadius: '8px' },
};

/** Apple Pay и Google Pay исключены по решению продукта. Остальное Stripe решает сам. */
const PAYMENT_ELEMENT_OPTIONS: StripePaymentElementOptions = {
  layout: 'tabs',
  wallets: { applePay: 'never', googlePay: 'never' },
};

const stripeByKey = new Map<string, Promise<Stripe | null>>();

/** Stripe.js грузится один раз на ключ: второй вызов `loadStripe` вставил бы второй скрипт. */
function stripeFor(publishableKey: string): Promise<Stripe | null> {
  const cached = stripeByKey.get(publishableKey);
  if (cached) return cached;
  const loaded = loadStripe(publishableKey);
  stripeByKey.set(publishableKey, loaded);
  return loaded;
}

/** У Stripe нет армянского языка: для `hy` берём английский, а не автоопределение браузера. */
function stripeLocale(locale: string): 'ru' | 'en' {
  return locale === 'ru' ? 'ru' : 'en';
}

interface StripePaymentFormProps {
  publishableKey: string;
  clientSecret: string;
  locale: string;
  totalLabel: string;
  onPaid: () => void;
}

/**
 * Встроенная форма Stripe Payment Element. Загружается лениво из провайдера оплаты, поэтому
 * скрипт Stripe.js не попадает на страницы, где оплата не открывалась.
 */
export function StripePaymentForm({ publishableKey, clientSecret, locale, totalLabel, onPaid }: StripePaymentFormProps) {
  const stripePromise = useMemo(() => stripeFor(publishableKey), [publishableKey]);
  const options = useMemo<StripeElementsOptions>(
    () => ({ clientSecret, appearance: APPEARANCE, locale: stripeLocale(locale) }),
    [clientSecret, locale],
  );

  return (
    <Elements stripe={stripePromise} options={options}>
      <StripeCheckoutForm totalLabel={totalLabel} onPaid={onPaid} />
    </Elements>
  );
}

function StripeCheckoutForm({ totalLabel, onPaid }: { totalLabel: string; onPaid: () => void }) {
  const t = useTranslations();
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setErrorKey(null);

    /*
     * `if_required`: переход на сайт банка не нужен. Методы с редиректом сервер исключает
     * (`allow_redirects: 'never'`), а подтверждение карты (3-D Secure) проходит в окне поверх
     * страницы. Адрес возврата Stripe требует формально, поэтому берём текущую страницу.
     */
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    });

    if (error) {
      setErrorKey(error.type === 'card_error' ? 'paymentSheet.declined' : 'paymentSheet.notCompleted');
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
      onPaid();
      return;
    }

    setErrorKey('paymentSheet.notCompleted');
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <PaymentElement options={PAYMENT_ELEMENT_OPTIONS} />

      {errorKey && (
        <p role="alert" className="text-caption font-semibold text-content-danger">
          {t(errorKey)}
        </p>
      )}

      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={!stripe || !elements || submitting}>
        {submitting ? t('paymentSheet.processing') : t('checkout.payment.submitCta', { total: totalLabel })}
      </Button>
    </form>
  );
}

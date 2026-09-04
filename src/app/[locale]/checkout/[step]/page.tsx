/**
 * ОФОРМЛЕНИЕ — сборка шага.
 *
 * Каждый шаг — свой URL (`checkoutSteps` в `config/routes.ts`), поэтому «назад»
 * браузера возвращает на предыдущий шаг, а не выбрасывает из оформления.
 * Неизвестный сегмент — 404: `/checkout/payments` не должен открывать первый шаг
 * и делать вид, что всё в порядке.
 *
 * **Маршрут приватный.** `/checkout/:path*` объявлен в `privatePaths`
 * (`config/cache.ts`) и получает `no-store`, а `noIndexPathPrefixes` закрывает
 * индексацию. Данные заказа не должны попасть ни в CDN, ни в выдачу.
 *
 * **Способы оплаты читаются на сервере.** `availablePaymentMethods()` смотрит в
 * окружение и потому server-only; компонент получает готовый список.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { CheckoutScreen } from '@/components/checkout/checkout-screen';
import { CheckoutStepper } from '@/components/checkout/checkout-stepper';
import { SiteFooter } from '@/components/layout/site-footer';
import { checkoutSteps, site, type CheckoutStep } from '@/config';
import { getCheckoutContent } from '@/server/content/checkout';
import type { Locale } from '@/i18n/config';

interface PageProps {
  params: Promise<{ locale: string; step: string }>;
}

/** Шаги известны заранее — оболочка каждого отдаётся из прегенерированной разметки. */
export function generateStaticParams() {
  return checkoutSteps.map((step) => ({ step }));
}

function toStep(value: string): CheckoutStep | null {
  return (checkoutSteps as readonly string[]).includes(value) ? (value as CheckoutStep) : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, step } = await params;
  const resolved = toStep(step);
  if (!resolved) return { title: undefined, robots: { index: false, follow: false } };

  const t = await getTranslations({ locale: locale as Locale, namespace: 'checkout' });

  return {
    title: `${t('title')} — ${t(`steps.${resolved}`)}`,
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutStepPage({ params }: PageProps) {
  const { locale, step } = await params;
  setRequestLocale(locale as Locale);

  const resolved = toStep(step);
  if (!resolved) notFound();

  const t = await getTranslations('checkout');
  const content = getCheckoutContent();

  return (
    <main id={site.mainContentId}>
      <div className="page-container inner-page">
        <h1 className="text-heading-2 mb-6">{t('title')}</h1>

        <CheckoutStepper current={resolved} className="mb-8" />

        <CheckoutScreen
          step={resolved}
          lines={content.cart.lines}
          promo={content.cart.promo}
          paymentMethods={content.paymentMethods}
          inlineCardForm={content.inlineCardForm}
          locale={locale as Locale}
        />
      </div>

      <SiteFooter />
    </main>
  );
}

/**
 * КОРЗИНА — сборка экрана, и только она.
 *
 * Страница остаётся серверной и статической: она отдаёт начальное состояние
 * корзины и способы оплаты, а всё поведение живёт в `CartScreen`. Так шапка,
 * подвал и оболочка приходят из кеша, а клиентский JavaScript загружается
 * только под интерактивную часть.
 *
 * **Маршрут приватный.** `/cart` объявлен в `privatePaths` (`config/cache.ts`) и
 * получает `no-store`: содержимое чужой корзины из CDN — не абстрактный риск, а
 * первое, что находят при аудите. Индексацию закрывает `noIndexPathPrefixes`
 * (`robots.ts`), поэтому `robots` в метаданных дублирует то же решение осознанно:
 * поисковику незачем видеть эту страницу даже по прямой ссылке.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CartScreen } from '@/components/cart/cart-screen';
import { SiteFooter } from '@/components/layout/site-footer';
import { site } from '@/config';
import { availablePaymentMethods } from '@/lib/payments';
import { getCartContent } from '@/server/content/cart';
import type { Locale } from '@/i18n/config';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'cart' });

  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export default async function CartPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations('cart');
  const content = getCartContent();

  return (
    <main id={site.mainContentId}>
      <div className="page-container inner-page">
        <h1 className="text-heading-2 mb-8">{t('title')}</h1>

        <CartScreen
          lines={content.lines}
          promo={content.promo}
          deliveryZone={content.deliveryZone}
          paymentMethods={availablePaymentMethods()}
          locale={locale as Locale}
        />
      </div>

      <SiteFooter />
    </main>
  );
}

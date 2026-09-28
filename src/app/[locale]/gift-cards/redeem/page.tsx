/**
 * GIFT CARDS REDEEM — A-21: активация карты по коду.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { GiftCardRedeemForm } from '@/components/gift-cards/gift-card-redeem-form';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { getContentHero } from '@/server/content/catalog';
import type { Crumb } from '@/lib/seo/jsonld';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: routes.giftCardsRedeem(), title: `${t('giftCards')} — ${t('activate')}`, noIndex: true });
}

export default async function GiftCardRedeemPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const tFooter = await getTranslations('footer');
  const trail: Crumb[] = [
    { name: tFooter('giftCards'), path: routes.giftCards() },
    { name: tFooter('activate'), path: routes.giftCardsRedeem() },
  ];
  return (
    <main id={site.mainContentId}>
      <PageHero title={tFooter('redeemGiftCard')} subtitle={tFooter('activateHint')} locale={locale as Locale} breadcrumbs={breadcrumbsFromTrail(trail)} image={getContentHero('giftCards')} />
      <div className="page-container py-12 md:py-16">
        <GiftCardRedeemForm />
      </div>
      <SiteFooter />
    </main>
  );
}

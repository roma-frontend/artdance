/**
 * CORPORATE — A-14: b2b тимбилдинг + форма заявки.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps { params: Promise<{ locale: string }>; }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: routes.corporate(), title: t('corporateTitle') });
}

export default async function CorporatePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('corporateTitle')}</h1>
      <p className="text-body mt-2 text-content-secondary">{t('corporateHint')}</p>
      <p className="text-body-sm mt-4 text-content-tertiary">{t('comingSoonHint')}</p>
      <SiteFooter />
    </main>
  );
}

/**
 * ACCESSIBILITY — A-26: заявление о доступности.
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
  const tF = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: routes.accessibility(), title: tF('accessibility'), noIndex: true });
}

export default async function AccessibilityPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const tF = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{tF('accessibility')}</h1>
      <p className="text-body mt-2 text-content-secondary">{tF('accessibilityNote')}</p>
      <SiteFooter />
    </main>
  );
}

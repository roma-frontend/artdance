// Заявка идёт через контактный канал с темой `corporate`; пакет не проверяется намеренно.

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ContactForm } from '@/components/content/contact-form';
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
      <div className="mt-8 max-w-2xl">
        <ContactForm locale={locale as Locale} defaultTopic="corporate" />
      </div>
      <SiteFooter />
    </main>
  );
}

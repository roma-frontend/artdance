/**
 * ACCOUNT DATA — A-10: экспорт/удаление данных (GDPR).
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { DataExportSection } from '@/components/account/data-export-section';
import { DataDeleteSection } from '@/components/account/data-delete-section';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { getCaller } from '@/lib/auth/guards';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: routes.accountData(), title: t('myData'), noIndex: true });
}

export default async function AccountDataPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  const caller = await getCaller();
  if (!caller) {
    const { redirect } = await import('@/i18n/routing');
    redirect({ href: routes.signIn(routes.accountData()), locale: locale as Locale } as never);
    return null;
  }

  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('privacyTitle')}</h1>
      <p className="text-body mt-2 text-content-secondary">{t('privacyHint')}</p>
      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <DataExportSection />
        <DataDeleteSection />
      </div>
      <SiteFooter />
    </main>
  );
}

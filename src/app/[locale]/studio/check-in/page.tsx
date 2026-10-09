/**
 * STUDIO CHECK-IN — A-07: сканер посещаемости (QR пропуска).
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { CheckInScanner } from '@/components/studio/check-in-scanner';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { getCaller } from '@/lib/auth/guards';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: '/studio/check-in', title: t('studioCheckInTitle'), noIndex: true });
}

export default async function StudioCheckInPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const token = typeof sp.token === 'string' ? sp.token : Array.isArray(sp.token) ? sp.token[0] : null;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  const caller = await getCaller();
  if (!caller) {
    const { redirect } = await import('@/i18n/routing');
    redirect({ href: routes.signIn('/studio/check-in' + (token ? `?token=${encodeURIComponent(token)}` : '')), locale: locale as Locale } as never);
    return null;
  }
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('studioCheckInTitle')}</h1>
      <p className="text-body mt-2 text-content-secondary">{t('studioCheckInHint')}</p>
      <div className="my-6">
        <CheckInScanner initialToken={token} hint={t('qrReadyHint')} />
      </div>
      <SiteFooter />
    </main>
  );
}

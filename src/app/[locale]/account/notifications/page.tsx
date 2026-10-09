/**
 * ACCOUNT NOTIFICATIONS — A-12: предпочтения уведомлений.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { getCaller } from '@/lib/auth/guards';

interface PageProps { params: Promise<{ locale: string }>;}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: '/account/notifications', title: t('notificationsTitle'), noIndex: true });
}

export default async function AccountNotificationsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  const caller = await getCaller();
  if (!caller) {
    const { redirect } = await import('@/i18n/routing');
    redirect({ href: routes.signIn('/account/notifications'), locale: locale as Locale } as never);
    return null;
  }
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('notificationsTitle')}</h1>
      <p className="text-body mt-2 text-content-secondary">{t('notificationsHint')}</p>
      <SiteFooter />
    </main>
  );
}

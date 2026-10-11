import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link, redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: routes.venueDashboard(), title: t('venueDashboardTitle'), noIndex: true });
}

export default async function VenuePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.venueDashboard()), locale: locale as Locale });
    return null;
  }
  const tCommon = await getTranslations({ locale: locale as Locale, namespace: 'common' });
  const tFooter = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{tFooter('venueDashboardTitle')}</h1>
      <p className="text-body mt-2 text-content-secondary">{tCommon('states.comingSoon')} — {tFooter('districtHint')}</p>
      <div className="mt-6 flex gap-3">
        <Button disabled variant="outline">{tFooter('venueDashboardRooms')}</Button>
        <Button asChild variant="ghost"><Link href={routes.account()}>{tCommon('actions.continue')}</Link></Button>
      </div>
      <SiteFooter />
    </main>
  );
}

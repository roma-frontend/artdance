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
  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  return buildMetadata({ locale: locale as Locale, path: routes.instructorDashboard(), title: t('title'), noIndex: true });
}

export default async function StudioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.instructorDashboard()), locale: locale as Locale });
    return null;
  }
  const tCommon = await getTranslations({ locale: locale as Locale, namespace: 'common' });
  const tFooter = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{tFooter('studioDashboardTitle')}</h1>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild variant="outline"><Link href={routes.instructorAvailability()}>{tFooter('studioDashboardAvailability')}</Link></Button>
        <Button asChild variant="outline"><Link href={routes.instructorClasses()}>{tFooter('studioDashboardClasses')}</Link></Button>
        <Button asChild variant="outline"><Link href={routes.instructorStudioReviews()}>{tFooter('studioDashboardReviews')}</Link></Button>
        <Button asChild variant="outline"><Link href={routes.instructorStudioBoost()}>{tFooter('studioDashboardBoost')}</Link></Button>
        <Button asChild variant="outline"><Link href={routes.instructorStudioAnalytics()}>{tFooter('studioDashboardAnalytics')}</Link></Button>
        <Button asChild variant="outline"><Link href={routes.instructorCheckIn()}>{tFooter('studioCheckInTitle')}</Link></Button>
        <Button asChild variant="outline"><Link href={routes.account()}>{tCommon('actions.continue')}</Link></Button>
      </div>
      <SiteFooter />
    </main>
  );
}

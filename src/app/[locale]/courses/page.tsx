import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'courses' });
  return buildMetadata({ locale: locale as Locale, path: routes.courses(), title: t('title'), description: t('subtitle') });
}

export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: 'courses' });
  const tCommon = await getTranslations({ locale: locale as Locale, namespace: 'common' });
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('title')}</h1>
      <p className="text-body mt-2 text-content-secondary">{t('subtitle')}</p>
      <div className="mt-10 rounded-xl border border-dashed border-border-default bg-surface-raised px-6 py-10 text-center">
        <p className="text-body text-content-secondary">{tCommon('states.comingSoon')}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button asChild variant="accent"><Link href={routes.classes()}>{tCommon('actions.explore')}</Link></Button>
          <Button asChild variant="outline"><Link href={routes.instructors()}>{tCommon('labels.instructor')}</Link></Button>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}

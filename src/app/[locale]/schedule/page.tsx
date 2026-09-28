/**
 * SCHEDULE — A-02: недельная сетка. P1.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ClassCard } from '@/components/catalog/class-card';
import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps { params: Promise<{ locale: string }>; }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: routes.schedule(), title: t('scheduleTitle') });
}

export default async function SchedulePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  const { getClassList } = await import('@/server/content/catalog');
  const classes = await getClassList({ sort: 'newest', page: 1, pageSize: 8 } as never).catch(() => ({ items: [] as never[], total: 0 }));
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('scheduleTitle')}</h1>
      <p className="text-body mt-2 text-content-secondary">{t('scheduleHint')}</p>
      {classes.items.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {classes.items.map((item) => (
            <li key={item.slug}><ClassCard item={item} locale={locale as Locale} /></li>
          ))}
        </ul>
      )}
      <SiteFooter />
    </main>
  );
}

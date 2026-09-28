/**
 * INSTRUCTOR REVIEWS — A-05: пагинированные отзывы инструктора.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps { params: Promise<{ locale: string; slug: string }>; }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: routes.instructorReviews(slug), title: t('instructorReviewsTitle', { slug }) });
}

export default async function InstructorReviewsPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('instructorReviewsTitle', { slug })}</h1>
      <p className="text-body mt-2 text-content-secondary">{t('common.states.comingSoon' as never)}</p>
      <SiteFooter />
    </main>
  );
}

// Видны только одобренные отзывы: фильтр задаёт `getInstructorReviewsPage`.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { ReviewList } from '@/components/reviews/review-list';
import { limits } from '@/config/business';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';
import { getInstructorReviewsPage } from '@/server/queries/instructors';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

/** Некорректный или отсутствующий номер страницы — первая страница, а не ошибка. */
function parsePage(raw: string | undefined): number {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: routes.instructorReviews(slug), title: t('instructorReviewsTitle', { slug }) });
}

export default async function InstructorReviewsPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  const { page: rawPage } = await searchParams;
  setRequestLocale(locale as Locale);

  const page = parsePage(rawPage);
  const pageSize = limits.pagination.reviewsPerPage;
  const data = await getInstructorReviewsPage({ slug, page, pageSize });
  if (!data) notFound();

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  if (page > totalPages) notFound();

  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  const title = t('instructorReviewsTitle', { slug });
  const base = routes.instructorReviews(slug);
  const pageLabel = t('reviewsPage', { page, total: totalPages });

  return (
    <main id={site.mainContentId} className="page-container inner-page">
      {/* Заголовок раздела выводит `ReviewList` (h2); h1 нужен документу, но не виден. */}
      <h1 className="sr-only">{title}</h1>
      <ReviewList rating={data.rating} items={data.items} locale={locale as Locale} title={title} />
      {totalPages > 1 && (
        <nav aria-label={pageLabel} className="mt-8 flex items-center justify-between gap-4">
          {page > 1 ? <Link href={`${base}?page=${page - 1}`}>{t('reviewsPrev')}</Link> : <span />}
          <span className="text-body-sm text-content-secondary">{pageLabel}</span>
          {page < totalPages ? <Link href={`${base}?page=${page + 1}`}>{t('reviewsNext')}</Link> : <span />}
        </nav>
      )}
      <SiteFooter />
    </main>
  );
}

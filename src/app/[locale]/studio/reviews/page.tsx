import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteFooter } from '@/components/layout/site-footer';
import { ReviewReplyPanel } from '@/components/studio/review-reply-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { requireInstructorProfile } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { buildMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'reviews' });
  return buildMetadata({ locale: locale as Locale, path: routes.instructorStudioReviews(), title: t('title'), noIndex: true });
}

/**
 * Отзывы на занятия инструктора с полем для ответа. Показываются только одобренные
 * отзывы: непроверенный текст в кабинете исполнителя не нужен.
 */
export default async function StudioReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const { instructorId } = await requireInstructorProfile();

  const reviews = await db.review.findMany({
    where: { instructorId, moderation: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      rating: true,
      body: true,
      createdAt: true,
      author: { select: { name: true } },
      response: { select: { body: true } },
    },
  });

  const t = await getTranslations({ locale: locale as Locale, namespace: 'reviews' });
  const format = await getFormatter({ locale: locale as Locale });

  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('title')}</h1>
      <p className="text-body mt-2 text-content-secondary">{t('studioSubtitle')}</p>

      {reviews.length === 0 ? (
        <div className="mt-10">
          <EmptyState title={t('empty')} />
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-card p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-card-title text-content-primary">{review.author.name}</p>
                <p className="text-body-sm text-content-secondary">{format.number(review.rating, 'rating')}</p>
                <time dateTime={review.createdAt.toISOString()} className="text-caption text-content-tertiary">
                  {format.dateTime(review.createdAt, 'mediumDate')}
                </time>
              </div>
              <p className="text-body-sm whitespace-pre-line text-content-secondary">{review.body}</p>
              <ReviewReplyPanel reviewId={review.id} existingReply={review.response?.body ?? null} />
            </li>
          ))}
        </ul>
      )}

      <SiteFooter />
    </main>
  );
}

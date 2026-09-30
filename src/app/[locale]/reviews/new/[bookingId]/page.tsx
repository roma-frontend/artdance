/**
 * REVIEWS NEW — A-08: отзыв по брони, токен в query (?token=...) без входа.
 * Если bookingId не найден или токен неверный — мягкая ошибка с CTA.
 */

import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { ReviewCreateForm } from '@/components/reviews/review-create-form';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { db } from '@/lib/db';

interface PageProps {
  params: Promise<{ locale: string; bookingId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale, bookingId } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: routes.reviewNew(bookingId), title: t('leaveReview'), noIndex: true });
}

export default async function ReviewNewPage({ params, searchParams }: PageProps) {
  const { locale, bookingId } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  const { token } = await searchParams;

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, endsAt: true },
  });
  if (!booking) notFound();

  // Уже есть отзыв — не показываем форму повторно.
  const existingReview = await db.review.findFirst({
    where: { bookingId },
    select: { id: true, rating: true },
  });

  if (token) {
    const vt = await db.verificationToken.findFirst({
      where: { identifier: `review:${bookingId}`, value: token },
      select: { expiresAt: true },
    });
    if (!vt || new Date(vt.expiresAt) < new Date()) {
      return (
        <main id={site.mainContentId} className="page-container inner-page">
          <h1 className="text-heading-2">{t('linkExpired')}</h1>
          <p className="text-body mt-3 text-content-secondary">{t('linkExpiredHint')}</p>
          <SiteFooter />
        </main>
      );
    }
  }

  if (existingReview) {
    return (
      <main id={site.mainContentId} className="page-container inner-page">
        <h1 className="text-heading-2">{t('leaveReview')}</h1>
        <p className="text-body mt-2 text-content-secondary">{t('reviewBodyHint', { id: bookingId.slice(0, 8) })}</p>
        <p role="status" className="mt-6 rounded-md border border-border-default bg-surface-card p-4 text-content-success">
          {(await getTranslations({ locale: locale as Locale, namespace: 'reviews' }))('pendingNotice')}
        </p>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('leaveReview')}</h1>
      <p className="text-body mt-2 text-content-secondary">{t('reviewBodyHint', { id: bookingId.slice(0, 8) })}</p>
      <div className="mt-6 max-w-xl">
        <ReviewCreateForm bookingId={bookingId} token={token} />
      </div>
      <SiteFooter />
    </main>
  );
}

/**
 * БРОНИРОВАНИЕ У ИНСТРУКТОРА — сборка экрана.
 *
 * **Страница динамическая, и это требование, а не настройка.** Доступность слотов
 * не кешируется вообще (`dataRevalidate.availability = 0`): устаревший ответ
 * здесь означает двойную бронь. Поэтому маршрут отдаётся на каждый запрос и
 * объявлен в `privatePaths` (`config/cache.ts`) — CDN не должен хранить ни
 * набор слотов, ни «первый доступный день», посчитанный на момент сборки.
 *
 * Неизвестный инструктор — 404, а не пустая сводка: страница бронирования того,
 * кого нет, не должна существовать.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { BookingScreen } from '@/components/booking/booking-screen';
import { SiteFooter } from '@/components/layout/site-footer';
import { site } from '@/config';
import { getInstructorBookingContent } from '@/server/content/booking';
import type { Locale } from '@/i18n/config';

/** Слоты живут секундами: ни ISR, ни CDN-кеш здесь недопустимы. */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'booking' });

  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export default async function InstructorBookingPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const content = getInstructorBookingContent(slug);
  if (!content) notFound();

  const t = await getTranslations('booking');

  return (
    <main id={site.mainContentId}>
      <div className="page-container inner-page">
        <h1 className="text-heading-2">{t('title')}</h1>
        <p className="text-body mt-2 mb-8 text-content-secondary">
          {t('subtitleWith', {
            title: content.classTitle,
            instructor: content.instructorName,
          })}
        </p>

        <BookingScreen content={content} />
      </div>

      <SiteFooter />
    </main>
  );
}

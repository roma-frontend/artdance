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

import { CalendarDaysIcon, ArrowRightIcon } from 'lucide-react';
import { BookingScreen } from '@/components/booking/booking-screen';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Link } from '@/i18n/routing';
import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import { getInstructorBookingContent } from '@/server/content/booking';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';

/** Слоты живут секундами: ни ISR, ни CDN-кеш здесь недопустимы. */
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ class?: string | string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'booking' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.instructorBooking(slug),
    title: t('title'),
    noIndex: true,
  });
}

export default async function InstructorBookingPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const query = await searchParams;
  if (Array.isArray(query.class) || query.class === '') notFound();
  const content = await getInstructorBookingContent(slug, new Date(), locale as Locale, query.class);
  if (!content) notFound();

  const t = await getTranslations('booking');

  if ('kind' in content) {
    return (
      <main id={site.mainContentId}>
        <div className="page-container inner-page">
          <p className="text-eyebrow mb-3 text-content-secondary">{content.instructorName}</p>
          <h1 className="text-heading-2 mb-8">{t('noClassesTitle')}</h1>
          <EmptyState
            icon={<CalendarDaysIcon className="size-12 text-content-metal" aria-hidden />}
            title={t('noClassesSubtitle', { instructor: content.instructorName })}
            description={t('noClassesDescription')}
            action={
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
                <Button asChild variant="accent" className="min-h-11 max-w-full whitespace-normal">
                  <Link href={routes.classes()}>
                    {t('browseClassesCta')}<ArrowRightIcon className="size-4 shrink-0" aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="min-h-11 max-w-full whitespace-normal">
                  <Link href={routes.instructor(content.instructorSlug)}>{t('backToInstructorCta')}</Link>
                </Button>
              </div>
            }
          />
        </div>
        <SiteFooter />
      </main>
    );
  }

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

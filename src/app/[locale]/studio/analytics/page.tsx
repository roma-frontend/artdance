import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { requireInstructorProfile } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';
import { getInstructorAnalytics } from '@/server/analytics/instructor';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'analytics' });
  return buildMetadata({ locale: locale as Locale, path: routes.instructorStudioAnalytics(), title: t('title'), noIndex: true });
}

/**
 * Аналитика инструктора: брони за последние 30 дней и оценка по одобренным отзывам.
 * Модуль `instructorAnalytics` входит в PREMIUM; без него страница говорит об этом
 * и не считает показатели.
 */
export default async function StudioAnalyticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const { instructorId } = await requireInstructorProfile();

  const t = await getTranslations({ locale: locale as Locale, namespace: 'analytics' });
  const format = await getFormatter();
  const entitlements = await getEffectiveEntitlementsSafe();

  if (!entitlements.instructorAnalytics) {
    return (
      <>
        <main id={site.mainContentId} className="page-container inner-page">
          <h1 className="text-heading-2">{t('title')}</h1>
          <p role="note" className="text-body-sm mt-6 text-content-secondary">{t('notIncluded')}</p>
        </main>
        <SiteFooter />
      </>
    );
  }

  const stats = await getInstructorAnalytics(instructorId);
  const count = (value: number) => format.number(value);
  const money = (value: number | null) => (value === null ? t('none') : format.number(value, 'price'));
  const percent = (value: number | null) => (value === null ? t('none') : format.number(value, { style: 'percent' }));
  const rating = stats.rating.average === null
    ? t('none')
    : format.number(stats.rating.average, { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  const cards = [
    { key: 'completed', value: count(stats.completed) },
    { key: 'revenue', value: money(stats.revenue) },
    { key: 'averageCheck', value: money(stats.averageCheck) },
    { key: 'attendance', value: percent(stats.attendanceRate) },
    { key: 'cancelled', value: count(stats.cancelled) },
    { key: 'noShows', value: count(stats.noShows) },
    { key: 'unmarked', value: count(stats.unmarked) },
    { key: 'uniqueClients', value: count(stats.uniqueClients) },
    { key: 'returningClients', value: count(stats.returningClients) },
    { key: 'rating', value: rating },
  ] as const;

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        <h1 className="text-heading-2">{t('title')}</h1>
        <p className="text-body mt-2 text-content-secondary">{t('intro', { days: stats.windowDays })}</p>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {cards.map((card) => (
            <div key={card.key} className="rounded-xl border border-border-default bg-surface-card p-4">
              <dt className="text-body-sm text-content-secondary">{t(`cards.${card.key}`)}</dt>
              <dd className="text-heading-3 mt-1">{card.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-body-sm mt-4 text-content-secondary">
          {t('ratingNote', { count: stats.rating.count })}
        </p>
      </main>
      <SiteFooter />
    </>
  );
}

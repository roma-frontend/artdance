import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { AvailabilityEditor } from '@/components/studio/availability-editor';
import type { ScheduleExceptionItem, ScheduleRuleItem } from '@/components/studio/types';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { requireInstructorProfile } from '@/lib/auth/guards';import { buildMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'studio.availability' });
  return buildMetadata({ locale: locale as Locale, path: routes.instructorAvailability(), title: t('title'), noIndex: true });
}

export default async function StudioAvailabilityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: 'studio.availability' });

  const { instructorId } = await requireInstructorProfile();

  const [ruleRows, exceptionRows] = await Promise.all([
    /* Запрос без кеша: правка и чтение должны видеть одно и то же мгновенно. */
    (await import('@/lib/db')).db.availabilityRule.findMany({
      where: { instructorId },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
      select: { id: true, weekday: true, startTime: true, endTime: true, validFrom: true, validUntil: true, isActive: true },
    }),
    (await import('@/lib/db')).db.availabilityException.findMany({
      where: { instructorId, endsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
      select: { id: true, startsAt: true, endsAt: true, isAvailable: true, reason: true },
    }),
  ]);

  const rules: ScheduleRuleItem[] = ruleRows.map((row) => ({
    id: row.id,
    weekday: row.weekday,
    startTime: row.startTime,
    endTime: row.endTime,
    validFrom: row.validFrom ? row.validFrom.toISOString().slice(0, 10) : null,
    validUntil: row.validUntil ? row.validUntil.toISOString().slice(0, 10) : null,
    isActive: row.isActive,
  }));

  const exceptions: ScheduleExceptionItem[] = exceptionRows.map((row) => ({
    id: row.id,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    isAvailable: row.isAvailable,
    reason: row.reason,
  }));

  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('title')}</h1>
      <p className="text-body mt-2 text-content-secondary">{t('subtitle')}</p>

      <AvailabilityEditor rules={rules} exceptions={exceptions} />

      <SiteFooter />
    </main>
  );
}

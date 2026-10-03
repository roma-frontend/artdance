/**
 * OVERVIEW — KPI кокпит (A-16).
 *
 * 4 состояния по 05-inventory: loading (loading.tsx), empty (нет прав или нет
 * данных), error (error.tsx раздела), denied — через AccessDenied на каждом
 * защищённом ресурсе, здесь через гвард adminAccess.
 *
 * Данные — из dashboard.ts, который считает только то, на что есть право
 * (null вместо скрытой колонки). Пусто здесь означает отсутствие данных, а не
 * отсутствие доступа — и путать их нельзя.
 */

import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatGrid, type StatSpec } from '@/components/data/stat';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { routes } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { getDashboardStats } from '@/server/admin/dashboard';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminOverviewPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can, capabilities } = await adminAccess();
  const tF = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  const t = await getTranslations({ locale: locale as Locale, namespace: 'admin.overview' });
  const tRoot = await getRootTranslate();
  const format = await getFormatter();

  // overview виден любому сотруднику; содержимое фильтруется по правам
  const stats = await getDashboardStats(capabilities);
  const hasRevenue = can('reports.revenue');
  const canSeeContent = can('content.manage') || can('catalog.view');

  const items: readonly StatSpec[] = [
    { labelKey: 'admin.overview.gmvTitle', value: stats.revenue, kind: 'money', hintKey: 'admin.overview.gmvHint' },
    { labelKey: 'admin.overview.takeRateTitle', value: null, kind: 'count', hintKey: 'admin.overview.takeRateHint' },
    { labelKey: 'admin.overview.occupancyTitle', value: null, kind: 'count', hintKey: 'admin.overview.occupancyHint' },
    { labelKey: 'admin.overview.conversionTitle', value: null, kind: 'count', hintKey: 'admin.overview.conversionHint' },
  ];

  const gmv = stats.revenue;
  const takeRate =
    gmv !== null && gmv > 0 && hasRevenue
      ? null
      : null;

  void takeRate;

  return (
    <>
      <AdminPageHeader titleKey="admin.overview.title" subtitleKey="admin.overview.subtitle" />

      <div className="flex flex-col gap-8">
        <section aria-labelledby="overview-kpi" className="flex flex-col gap-4">
          <h2 id="overview-kpi" className="text-card-title text-content-primary">
            {t('title')}
          </h2>
          <StatGrid items={items} />
          {gmv === null && !hasRevenue ? (
            <p className="text-caption text-content-tertiary">{tF('adminOverviewNote')}</p>
          ) : null}
          {gmv === 0 ? (
            <EmptyState title={t('empty')} description={t('emptyHint')} />
          ) : null}
          {gmv !== null ? (
            <p className="text-body-sm text-content-secondary">
              {format.number(gmv, 'price')} · {t('gmvHint')}
            </p>
          ) : null}
        </section>

        <section aria-labelledby="overview-actions" className="flex flex-col gap-4">
          <h2 id="overview-actions" className="text-card-title text-content-primary">
            {tRoot('admin.dashboard.shortcuts')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild variant="outline">
              <Link href={routes.adminReports()}>{t('ctaReports')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.adminBookings()}>{t('ctaSchedule')}</Link>
            </Button>
            {canSeeContent ? (
              <Button asChild variant="ghost">
                <Link href={routes.adminTrash({})}>{tRoot('admin.nav.trash')}</Link>
              </Button>
            ) : null}
          </div>
          <p className="text-caption text-content-tertiary">{tF('adminOverviewNote')}</p>
        </section>
      </div>
    </>
  );
}

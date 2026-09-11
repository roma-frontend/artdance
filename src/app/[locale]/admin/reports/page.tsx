/**
 * ОТЧЁТЫ — оборот, брони, комиссия за период.
 *
 * Три диапазона вместо календаря: произвольный период требует валидации,
 * пагинации и обсуждения часовых поясов, а вопрос, который задают на этом экране,
 * звучит «как прошёл месяц». Календарь появится вместе с запросом на него, а не
 * заранее.
 *
 * Комиссия берётся из `CommissionRecord`, где ставка зафиксирована в момент
 * операции, а не считается из текущего конфига: иначе изменение ставки
 * переписывало бы прошлые отчёты.
 */

import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ExportButton } from '@/components/data/export-button';
import { StatGrid, type StatSpec } from '@/components/data/stat';
import { AccessDenied } from '@/components/ui/access-denied';
import { EmptyState } from '@/components/ui/empty-state';
import { routes } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { getReportTotals, type ReportRange } from '@/server/admin/people';
import { parseAdminQuery } from '@/server/admin/query-params';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const ranges: readonly { id: ReportRange; labelKey: 'range30' | 'range90' | 'rangeYear' }[] = [
  { id: '30', labelKey: 'range30' },
  { id: '90', labelKey: 'range90' },
  { id: '365', labelKey: 'rangeYear' },
];

export default async function AdminReportsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  if (!can('reports.revenue')) return <AccessDenied />;

  const query = parseAdminQuery(await searchParams);
  const range: ReportRange = ranges.some((item) => item.id === query.range)
    ? (query.range as ReportRange)
    : '30';

  const totals = await getReportTotals(range);
  const t = await getTranslations('admin.reports');
  const tRoot = await getRootTranslate();
  const format = await getFormatter();

  const stats: readonly StatSpec[] = [
    { labelKey: 'admin.reports.revenueTitle', value: totals.revenue, kind: 'money' },
    { labelKey: 'admin.reports.commissionTitle', value: totals.commission, kind: 'money' },
    { labelKey: 'admin.reports.ordersTitle', value: totals.orders, kind: 'count' },
    { labelKey: 'admin.reports.bookingsTitle', value: totals.bookings, kind: 'count' },
  ];

  const empty = totals.revenue === 0 && totals.orders === 0 && totals.bookings === 0;

  return (
    <>
      <AdminPageHeader
        titleKey="admin.reports.title"
        subtitleKey="admin.reports.subtitle"
        actions={can('data.export') ? <ExportButton range={range} /> : undefined}
      />

      <div className="flex flex-col gap-8">
        <nav aria-label={t('rangeLabel')} className="flex flex-wrap gap-2">
          {ranges.map((item) => (
            <Link
              key={item.id}
              href={routes.adminReports({ range: item.id })}
              aria-current={range === item.id ? 'page' : undefined}
              className={cn(
                'text-button rounded-full px-4 py-2 transition-colors duration-fast',
                range === item.id
                  ? 'bg-accent text-content-on-accent'
                  : 'bg-surface-sunken text-content-secondary hover:text-content-primary',
              )}
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>

        {empty ? (
          <EmptyState title={t('emptyRange')} />
        ) : (
          <>
            <StatGrid items={stats} />

            <div className="grid gap-8 md:grid-cols-2">
              <section aria-labelledby="report-instructors">
                <h2 id="report-instructors" className="text-card-title mb-4 text-content-primary">
                  {t('topInstructors')}
                </h2>
                <ul className="flex flex-col gap-2">
                  {totals.topInstructors.map((row) => (
                    <li
                      key={row.name}
                      className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2"
                    >
                      <span className="text-body-sm text-content-primary">{row.name}</span>
                      <span className="text-body-sm text-content-secondary">
                        {format.number(row.amount, 'price')}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="report-classes">
                <h2 id="report-classes" className="text-card-title mb-4 text-content-primary">
                  {t('topClasses')}
                </h2>
                <ul className="flex flex-col gap-2">
                  {totals.topClasses.map((row) => (
                    <li
                      key={row.title}
                      className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2"
                    >
                      <span className="text-body-sm text-content-primary">{row.title}</span>
                      <span className="text-body-sm text-content-secondary">
                        {tRoot('common.counts.items', { count: row.count })}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}

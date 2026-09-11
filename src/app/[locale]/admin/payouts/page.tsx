/**
 * ВЫПЛАТЫ — деньги, причитающиеся инструкторам и площадкам.
 *
 * Единственный раздел, где операция двигает деньги наружу, поэтому кнопка
 * «отправить» видна только с правом `payouts.release` и требует подтверждения.
 * Номер счёта показывается маской: полного номера в БД нет по построению
 * (`PayoutAccount.accountMasked`), и это правильно — админке он не нужен.
 */

import { setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { PayoutActions } from '@/components/admin/status-actions';
import { DataTable } from '@/components/data/data-table';
import { TableFilters } from '@/components/data/table-filters';
import { AccessDenied } from '@/components/ui/access-denied';
import { adminPayoutColumns } from '@/config';
import { payoutStatusLabelKey, payoutStatuses } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { listPayouts } from '@/server/admin/operations';
import { parseAdminQuery } from '@/server/admin/query-params';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminPayoutsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  if (!can('payouts.view')) return <AccessDenied />;

  const query = parseAdminQuery(await searchParams);
  const { rows, total } = await listPayouts(query);
  const tRoot = await getRootTranslate();

  const canRelease = can('payouts.release');

  return (
    <>
      <AdminPageHeader titleKey="admin.payouts.title" subtitleKey="admin.payouts.subtitle" />

      <div className="flex flex-col gap-6">
        <TableFilters
          target={{ kind: 'payouts' }}
          statusOptions={payoutStatuses.map((status) => ({
            value: status,
            labelKey: payoutStatusLabelKey(status),
          }))}
        />

        <DataTable
          rowLink={{ kind: 'none' }}
          columns={adminPayoutColumns}
          rows={rows}
          primaryKey="reference"
          resourceLabel={tRoot('admin.payouts.title')}
          filtered={Boolean(query.q ?? query.status)}
        />

        {canRelease ? (
          <ul className="flex flex-col gap-3">
            {rows
              .filter((row) => row.status !== 'PAID')
              .map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-default bg-surface-card px-4 py-3"
                >
                  <span className="text-body-sm text-content-primary">{String(row.reference)}</span>
                  <PayoutActions id={row.id} />
                </li>
              ))}
          </ul>
        ) : null}

        <p className="text-body-sm text-content-secondary">
          {tRoot('admin.list.resultsCount', { count: total })}
        </p>
      </div>
    </>
  );
}

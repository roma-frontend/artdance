/**
 * ЗАКАЗЫ — список с фильтром по статусу.
 *
 * Отдельная страница, а не раздел реестра: заказ нельзя создать формой и нельзя
 * править как набор полей. Администратор двигает его состояние и оформляет
 * возврат — это операции с правилами, а не запись значений.
 */

import { setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable } from '@/components/data/data-table';
import { TableFilters } from '@/components/data/table-filters';
import { AccessDenied } from '@/components/ui/access-denied';
import { adminOrderColumns } from '@/config';
import { orderStatusLabelKey, orderStatuses } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { listOrders } from '@/server/admin/operations';
import { parseAdminQuery } from '@/server/admin/query-params';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminOrdersPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  if (!can('orders.view')) return <AccessDenied />;

  const query = parseAdminQuery(await searchParams);
  const { rows, total } = await listOrders(query);
  const tRoot = await getRootTranslate();

  return (
    <>
      <AdminPageHeader titleKey="admin.orders.title" subtitleKey="admin.orders.subtitle" />

      <div className="flex flex-col gap-6">
        <TableFilters
          target={{ kind: 'orders' }}
          statusOptions={orderStatuses.map((status) => ({
            value: status,
            labelKey: orderStatusLabelKey(status),
          }))}
        />

        <DataTable
          rowLink={{ kind: 'order' }}
          columns={adminOrderColumns}
          rows={rows}
          primaryKey="orderNumber"
          resourceLabel={tRoot('admin.orders.title')}
          filtered={Boolean(query.q ?? query.status)}
        />

        <p className="text-body-sm text-content-secondary">
          {tRoot('admin.list.resultsCount', { count: total })}
        </p>
      </div>
    </>
  );
}

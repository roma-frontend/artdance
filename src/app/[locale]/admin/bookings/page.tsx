/**
 * БРОНИ — список с фильтром по статусу.
 *
 * Порядок — по дате занятия, а не по дате создания: работа поддержки идёт от
 * ближайшего занятия, а не от того, кто раньше забронировал.
 */

import { setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable } from '@/components/data/data-table';
import { TableFilters } from '@/components/data/table-filters';
import { AccessDenied } from '@/components/ui/access-denied';
import { adminBookingColumns } from '@/config';
import { bookingStatusLabelKey, bookingStatuses } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { listBookings } from '@/server/admin/operations';
import { parseAdminQuery } from '@/server/admin/query-params';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminBookingsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  if (!can('bookings.view')) return <AccessDenied />;

  const query = parseAdminQuery(await searchParams);
  const { rows, total } = await listBookings(query);
  const tRoot = await getRootTranslate();

  return (
    <>
      <AdminPageHeader titleKey="admin.bookings.title" subtitleKey="admin.bookings.subtitle" />

      <div className="flex flex-col gap-6">
        <TableFilters
          target={{ kind: 'bookings' }}
          statusOptions={bookingStatuses.map((status) => ({
            value: status,
            labelKey: bookingStatusLabelKey(status),
          }))}
        />

        <DataTable
          rowLink={{ kind: 'booking' }}
          columns={adminBookingColumns}
          rows={rows}
          primaryKey="reference"
          resourceLabel={tRoot('admin.bookings.title')}
          filtered={Boolean(query.q ?? query.status)}
        />

        <p className="text-body-sm text-content-secondary">
          {tRoot('admin.list.resultsCount', { count: total })}
        </p>
      </div>
    </>
  );
}

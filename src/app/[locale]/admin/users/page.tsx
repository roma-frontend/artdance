/**
 * ПОЛЬЗОВАТЕЛИ — список аккаунтов с фильтром по роли.
 *
 * Фильтр по роли лежит в том же параметре `status`, что и статусы в других
 * списках: панель фильтров одна на всю админку, и заводить ей второй параметр
 * ради одного экрана значит получить два способа фильтровать.
 */

import { setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable } from '@/components/data/data-table';
import { TableFilters } from '@/components/data/table-filters';
import { AccessDenied } from '@/components/ui/access-denied';
import { adminUserColumns } from '@/config';
import { userRoleLabelKey, userRoles } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { listUsers } from '@/server/admin/people';
import { parseAdminQuery } from '@/server/admin/query-params';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminUsersPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  if (!can('users.view')) return <AccessDenied />;

  const query = parseAdminQuery(await searchParams);
  const { rows, total } = await listUsers(query);
  const tRoot = await getRootTranslate();

  return (
    <>
      <AdminPageHeader titleKey="admin.users.title" subtitleKey="admin.users.subtitle" />

      <div className="flex flex-col gap-6">
        <TableFilters
          target={{ kind: 'users' }}
          statusOptions={userRoles.map((role) => ({ value: role, labelKey: userRoleLabelKey(role) }))}
        />

        <DataTable
          rowLink={{ kind: 'user' }}
          columns={adminUserColumns}
          rows={rows}
          primaryKey="name"
          resourceLabel={tRoot('admin.users.title')}
          filtered={Boolean(query.q ?? query.status)}
        />

        <p className="text-body-sm text-content-secondary">
          {tRoot('admin.list.resultsCount', { count: total })}
        </p>
      </div>
    </>
  );
}

/**
 * ЖУРНАЛ ДЕЙСТВИЙ — кто что изменил и когда.
 *
 * Существует ради одного вопроса, который однажды задаст владелец платформы: «кто
 * поменял цену занятия во вторник». Поэтому здесь фильтр по сущности и поиск по
 * действию, адресу почты и идентификатору записи — то, чем этот вопрос обычно
 * сформулирован.
 *
 * Значения в `diff` уже обезличены (`recordAudit` маскирует пароли, токены,
 * номера карт и частично почту с телефоном), поэтому журнал безопасно показывать
 * поддержке с правом `audit.view`.
 */

import { setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DataTable } from '@/components/data/data-table';
import { TableFilters } from '@/components/data/table-filters';
import { AccessDenied } from '@/components/ui/access-denied';
import { adminAuditColumns } from '@/config';
import type { Locale } from '@/i18n/config';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { auditEntityTypes, listAuditLog } from '@/server/admin/people';
import { parseAdminQuery } from '@/server/admin/query-params';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminAuditLogPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  if (!can('audit.view')) return <AccessDenied />;

  const query = parseAdminQuery(await searchParams);
  const [{ rows, total }, entityTypes] = await Promise.all([listAuditLog(query), auditEntityTypes()]);
  const tRoot = await getRootTranslate();

  return (
    <>
      <AdminPageHeader titleKey="admin.audit.title" subtitleKey="admin.audit.subtitle" />

      <div className="flex flex-col gap-6">
        <TableFilters
          target={{ kind: 'auditLog' }}
          statusOptions={entityTypes.map((type) => ({ value: type, label: type }))}
        />

        <DataTable
          rowLink={{ kind: 'none' }}
          columns={adminAuditColumns}
          rows={rows}
          primaryKey="action"
          resourceLabel={tRoot('admin.audit.title')}
          filtered={Boolean(query.q ?? query.status)}
        />

        <p className="text-body-sm text-content-secondary">
          {tRoot('admin.list.resultsCount', { count: total })}
        </p>
      </div>
    </>
  );
}

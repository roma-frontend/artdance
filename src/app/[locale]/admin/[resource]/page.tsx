/**
 * СПИСОК РАЗДЕЛА АДМИНКИ — одна страница на все четырнадцать ресурсов.
 *
 * Что здесь происходит по шагам: разобрать раздел из адреса, проверить право на
 * чтение, разобрать фильтры из query, прочитать страницу данных, отдать таблице
 * описание колонок. Ни одного знания о конкретной сущности на этой странице нет —
 * всё приходит из `adminResourceSpecs` и реестра.
 *
 * Фильтры и страница живут в URL, потому что ссылку на отбор пересылают коллеге,
 * а из записи возвращаются кнопкой «назад» — состояние в компоненте не умеет
 * ни того, ни другого.
 */

import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BulkActionBar } from '@/components/data/bulk-action-bar';
import { DataTable } from '@/components/data/data-table';
import { TableFilters, type FilterOption } from '@/components/data/table-filters';
import { TablePagination } from '@/components/data/table-pagination';
import { AccessDenied } from '@/components/ui/access-denied';
import { Button } from '@/components/ui/button';
import { adminResourceSpecs, isAdminResource, routes } from '@/config';
import { moderationStatusLabelKey, moderationStatuses } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { getRootTranslate } from '@/i18n/translate';
import type { AdminBulkAction } from '@/server/actions/admin/resource';
import { adminAccess } from '@/server/admin/access';
import { parseAdminQuery } from '@/server/admin/query-params';
import { listResource } from '@/server/admin/registry';

interface PageProps {
  params: Promise<{ locale: string; resource: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminResourceListPage({ params, searchParams }: PageProps) {
  const { locale, resource } = await params;
  setRequestLocale(locale as Locale);

  if (!isAdminResource(resource)) notFound();

  const spec = adminResourceSpecs[resource];
  const { can } = await adminAccess();
  if (!can(spec.view)) return <AccessDenied />;

  const query = parseAdminQuery(await searchParams);
  const { rows, total, page, pageCount } = await listResource(resource, query);

  const t = await getTranslations('admin');
  const tRoot = await getRootTranslate();
  const resourceLabel = tRoot(spec.titleKey);

  const filtered = Boolean(query.q ?? query.status);
  const canEdit = can(spec.edit);
  const bulkActions = canEdit && can('action.bulk') ? bulkActionsFor(spec.statusFilter, spec.deletable) : [];

  const table = (
    <DataTable
      rowLink={{ kind: 'resource', resource }}
      columns={spec.columns}
      rows={rows}
      primaryKey={spec.primaryField}
      selectable={bulkActions.length > 0}
      resourceLabel={resourceLabel}
      filtered={filtered}
    />
  );

  return (
    <>
      <AdminPageHeader
        titleKey={spec.titleKey}
        subtitleKey={spec.subtitleKey}
        parent={spec.parent ? { href: routes.adminResource(spec.parent.resource), labelKey: adminResourceSpecs[spec.parent.resource].titleKey } : undefined}
        actions={
          canEdit && spec.creatable ? (
            <Button asChild variant="accent" size="sm">
              <Link href={routes.adminResourceNew(resource, query.parent)}>{t('actions.newRecord')}</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-6">
        <TableFilters
          target={{ kind: 'resource', resource }}
          searchable={spec.searchable}
          statusOptions={statusOptionsFor(spec.statusFilter)}
          sortOptions={[]}
          parent={query.parent}
        />

        {bulkActions.length > 0 ? (
          <BulkActionBar resource={resource} actions={bulkActions}>
            {table}
          </BulkActionBar>
        ) : (
          table
        )}

        <TablePagination
          target={{ kind: 'resource', resource }}
          page={page}
          pageCount={pageCount}
          total={total}
          query={query}
        />
      </div>
    </>
  );
}

/** Варианты фильтра статуса по типу состояния сущности. */
function statusOptionsFor(kind: 'active' | 'published' | 'moderation' | 'none'): readonly FilterOption[] {
  switch (kind) {
    case 'active':
      return [
        { value: 'true', labelKey: 'admin.fields.isActive' },
        { value: 'false', labelKey: 'admin.actions.deactivate' },
      ];
    case 'published':
      return [
        { value: 'true', labelKey: 'admin.actions.publish' },
        { value: 'false', labelKey: 'admin.actions.unpublish' },
      ];
    case 'moderation':
      return moderationStatuses.map((status) => ({
        value: status,
        labelKey: moderationStatusLabelKey(status),
      }));
    case 'none':
      return [];
  }
}

/**
 * Массовые действия, применимые к разделу. Публикация не предлагается там, где у
 * сущности нет публикации: кнопка, которая всегда отвечает ошибкой, хуже её
 * отсутствия.
 */
function bulkActionsFor(
  kind: 'active' | 'published' | 'moderation' | 'none',
  deletable: boolean,
): readonly AdminBulkAction[] {
  const flags: readonly AdminBulkAction[] =
    kind === 'active'
      ? ['activate', 'deactivate']
      : kind === 'published'
        ? ['publish', 'unpublish']
        : [];

  return deletable ? [...flags, 'delete'] : flags;
}

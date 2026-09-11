/**
 * КОРЗИНА — удалённое, что ещё можно вернуть.
 *
 * Один экран на все разделы, а не «корзина занятий» и «корзина товаров»: человек,
 * который что-то удалил не то, не помнит раздел — он помнит, что удалил минуту
 * назад. Поэтому разделы здесь переключатель, а не отдельные адреса, и в
 * переключателе показаны только те, где что-то есть.
 *
 * Три права, и они разные по последствиям: `trash.view` — смотреть,
 * `trash.restore` — вернуть, `trash.purge` — стереть навсегда. Поддержка обычно
 * имеет только первое: «кто и что удалил» — обычный вопрос обращения, а решение
 * принимает администратор.
 *
 * Таблица здесь своя, а не `DataTable`. Причина не в разметке: у `DataTable`
 * первая колонка — ссылка на запись, а записи в корзине для приложения не
 * существует, открывать нечего. Вместо ссылки в строке два действия, и они
 * относятся к строке, а не к разделу.
 */

import { setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { TrashActions } from '@/components/admin/trash-actions';
import { TablePagination } from '@/components/data/table-pagination';
import { AccessDenied } from '@/components/ui/access-denied';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminResourceSpecs, routes, trash, type AdminResource } from '@/config';
import { daysLeftInTrash } from '@/domain/trash';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { parseAdminQuery } from '@/server/admin/query-params';
import { isTrashableResource, listTrash, trashCounts } from '@/server/admin/trash';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminTrashPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  if (!can('trash.view')) return <AccessDenied />;

  const query = parseAdminQuery(await searchParams);
  const counts = await trashCounts();
  const sections = Object.keys(counts) as AdminResource[];

  const tRoot = await getRootTranslate();

  if (sections.length === 0) {
    return (
      <>
        <AdminPageHeader
          titleKey="admin.trash.title"
          subtitle={tRoot('admin.trash.subtitle', { days: trash.retentionDays })}
        />
        <EmptyState
          title={tRoot('admin.trash.empty')}
          description={tRoot('admin.trash.emptyHint', { days: trash.retentionDays })}
        />
      </>
    );
  }

  /*
   * Раздел из адреса, если он есть в корзине; иначе первый непустой. Пустая
   * страница с надписью «ничего нет» при непустой корзине — худший из вариантов:
   * человек решает, что удалённое потеряно.
   */
  const requested = query.tab;
  const active =
    requested && isTrashableResource(requested as AdminResource) && sections.includes(requested as AdminResource)
      ? (requested as AdminResource)
      : (sections[0] as AdminResource);

  const page = query.page ?? 1;
  const { entries, total, pageCount } = await listTrash(active, page);
  const now = new Date();

  return (
    <>
      <AdminPageHeader
        titleKey="admin.trash.title"
        subtitle={tRoot('admin.trash.subtitle', { days: trash.retentionDays })}
      />

      <div className="flex flex-col gap-6">
        <nav aria-label={tRoot('admin.trash.sectionLabel')} className="flex flex-wrap gap-2">
          {sections.map((section) => (
            <Button
              key={section}
              asChild
              size="sm"
              variant={section === active ? 'accent' : 'outline'}
            >
              <Link
                href={routes.adminTrash({ tab: section })}
                aria-current={section === active ? 'page' : undefined}
              >
                {tRoot(adminResourceSpecs[section].navLabelKey)}
                <Badge variant="neutral" size="sm" className="ml-2">
                  {counts[section]}
                </Badge>
              </Link>
            </Button>
          ))}
        </nav>

        <div className="overflow-hidden rounded-lg border border-border-default bg-surface-card">
          <Table>
            <TableCaption className="sr-only">
              {`${tRoot(adminResourceSpecs[active].navLabelKey)} — ${tRoot('admin.list.resultsCount', { count: total })}`}
            </TableCaption>

            <TableHeader>
              <TableRow>
                <TableHead>{tRoot('admin.fields.title')}</TableHead>
                <TableHead>{tRoot('admin.trash.deletedAt')}</TableHead>
                <TableHead>
                  <span className="sr-only">{tRoot('admin.actions.restore')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-semibold text-content-primary">{entry.label}</TableCell>
                  <TableCell className="text-content-secondary">
                    {/*
                      Дата удаления и остаток срока рядом: одна отвечает «когда это
                      случилось», другая — «сколько осталось на решение». Порознь
                      каждая заставляет считать в голове.
                    */}
                    <span className="block">{entry.deletedAt.toISOString().slice(0, 10)}</span>
                    <span className="text-caption text-content-tertiary">
                      {tRoot('admin.trash.daysLeft', { count: daysLeftInTrash(entry.deletedAt, now) })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <TrashActions
                      resource={entry.resource}
                      id={entry.id}
                      label={entry.label}
                      canRestore={can('trash.restore')}
                      canPurge={can('trash.purge')}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          target={{ kind: 'trash' }}
          page={page}
          pageCount={pageCount}
          total={total}
          query={{ tab: active }}
        />

        <p className="text-body-sm text-content-secondary">
          {tRoot('admin.trash.restoreHint')}
        </p>
      </div>
    </>
  );
}

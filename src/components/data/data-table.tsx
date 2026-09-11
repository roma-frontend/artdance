/**
 * DATA TABLE — таблица админки. Одна на все разделы.
 *
 * Компонент серверный, и это осознанно. Таблица админки — это отображение
 * серверных данных: сортировка, фильтр и страница живут в URL, значит на каждое
 * изменение всё равно происходит запрос. Клиентская таблица здесь означала бы
 * копию тех же данных в бандле, второй путь форматирования чисел и дат и
 * гидратацию тысячи ячеек ради нуля интерактивности.
 *
 * Выбор строк тоже без состояния в React: чекбоксы — обычные `<input name="ids">`
 * внутри формы, которую держит `BulkActionForm`. Родитель читает `FormData`, а не
 * массив в состоянии, поэтому таблица остаётся серверной, а «выбрать 40 строк и
 * снять с публикации» работает без единого `useState`.
 *
 * Форматирование значений — единственное место в админке, где это происходит:
 * `kind` колонки решает, деньги это, дата или статус. Прямой `toLocaleString` в
 * ячейке запрещён, иначе в одном списке цена «12000», а в другом «12 000 ֏».
 */

import type { ReactNode } from 'react';
import { getFormatter, getTranslations } from 'next-intl/server';

import { StatusBadge } from '@/components/data/status-badge';
import { Badge } from '@/components/ui/badge';
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
import { routes, type AdminColumnSpec, type AdminResource } from '@/config';
import {
  bookingStatuses,
  isUserRole,
  moderationStatuses,
  orderStatuses,
  paymentStatuses,
  payoutStatuses,
  userRoleLabelKey,
} from '@/domain/enums';
import { Link } from '@/i18n/routing';
import { getRootTranslate, type Translate } from '@/i18n/translate';
import { cn } from '@/lib/utils';

/**
 * Значение ячейки. Только сериализуемое: строки, числа, флаги и списки строк.
 * `Date` в этот тип не входит намеренно — дата приходит ISO-строкой, потому что
 * между сервером и разметкой она всё равно проходит сериализацию, и лучше видеть
 * это в типе, чем ловить рассинхрон разметки.
 */
export type AdminCellValue = string | number | boolean | null | undefined | readonly string[];

export interface AdminRow {
  id: string;
  [key: string]: AdminCellValue;
}

type Formatter = Awaited<ReturnType<typeof getFormatter>>;

/**
 * Куда ведёт первая колонка строки.
 *
 * Объект-описание, а не функция: таблицу рисует сервер, а адреса собирает
 * `routes`. Заказ и бронь — не ресурсы реестра (их не создают формой), поэтому у
 * них свои экраны; у выплат детального экрана нет вообще, и `none` честнее
 * ссылки, ведущей в никуда.
 */
export type AdminRowLink =
  | { kind: 'resource'; resource: AdminResource }
  | { kind: 'order' }
  | { kind: 'booking' }
  | { kind: 'user' }
  | { kind: 'none' };

function hrefFor(link: AdminRowLink, id: string): string | null {
  switch (link.kind) {
    case 'resource':
      return routes.adminResourceEdit(link.resource, id);
    case 'order':
      return routes.adminOrder(id);
    case 'booking':
      return routes.adminBooking(id);
    case 'user':
      return routes.adminUser(id);
    case 'none':
      return null;
  }
}

interface DataTableProps {
  /** Куда ведёт запись. Функцию-пропс передавать нельзя, поэтому — описание. */
  rowLink: AdminRowLink;
  columns: readonly AdminColumnSpec[];
  rows: readonly AdminRow[];
  /** Колонка-ссылка на запись. */
  primaryKey: string;
  /** Показывать чекбоксы выбора строк. */
  selectable?: boolean;
  /** Подпись таблицы для скринридеров: «Занятия: 12 записей». */
  resourceLabel: string;
  /** Список пуст из-за фильтров, а не потому что раздел новый. */
  filtered?: boolean;
  className?: string;
}

export async function DataTable({
  rowLink,
  columns,
  rows,
  primaryKey,
  selectable = false,
  resourceLabel,
  filtered = false,
  className,
}: DataTableProps) {
  const t = await getTranslations('admin');
  const tRoot = await getRootTranslate();
  const format = await getFormatter();

  if (rows.length === 0) {
    return (
      <EmptyState
        title={t(filtered ? 'list.emptyFiltered' : 'list.empty')}
        description={filtered ? undefined : t('list.emptyHint')}
      />
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border-default bg-surface-card', className)}>
      <Table>
        <TableCaption className="sr-only">
          {t('list.tableCaption', { resource: resourceLabel, count: rows.length })}
        </TableCaption>

        <TableHeader>
          <TableRow>
            {selectable ? (
              <TableHead className="w-10">
                <span className="sr-only">{t('list.selectRow')}</span>
              </TableHead>
            ) : null}

            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  'text-label whitespace-nowrap',
                  column.secondary === true && 'hidden lg:table-cell',
                )}
              >
                {tRoot(column.labelKey)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {selectable ? (
                <TableCell>
                  {/*
                   * Обычный input, а не Radix-чекбокс: значение обязано попасть в
                   * `FormData` родительской формы. Radix рисует кнопку и скрытое
                   * поле, и полагаться на это в массовых действиях — лишний риск.
                   */}
                  <input
                    type="checkbox"
                    name="ids"
                    value={row.id}
                    aria-label={t('list.selectRow')}
                    className="size-4 rounded-sm border-border-strong accent-accent"
                  />
                </TableCell>
              ) : null}

              {columns.map((column) => {
                const href = column.key === primaryKey ? hrefFor(rowLink, row.id) : null;

                return (
                  <TableCell
                    key={column.key}
                    className={cn(
                      'align-middle',
                      column.secondary === true && 'hidden lg:table-cell',
                      column.key === primaryKey && 'font-semibold',
                    )}
                  >
                    {href ? (
                      <Link
                        href={href}
                        className="text-content-primary underline-offset-4 hover:text-content-accent hover:underline"
                      >
                        {renderCell(column, row[column.key], format, tRoot) ?? row.id}
                      </Link>
                    ) : (
                      renderCell(column, row[column.key], format, tRoot)
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ────────────────────────────── Форматирование ────────────────────────────── */

function renderCell(
  column: AdminColumnSpec,
  value: AdminCellValue,
  format: Formatter,
  t: Translate,
): ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-content-tertiary">—</span>;
  }

  switch (column.kind) {
    case 'money':
      return typeof value === 'number' ? format.number(value, 'price') : String(value);

    case 'number':
      return typeof value === 'number' ? format.number(value, 'plain') : String(value);

    case 'rate':
      return typeof value === 'number' ? format.number(value, 'rating') : String(value);

    case 'date':
      return typeof value === 'string' ? (
        <time dateTime={value}>{format.dateTime(new Date(value), 'mediumDate')}</time>
      ) : null;

    case 'datetime':
      return typeof value === 'string' ? (
        <time dateTime={value}>{format.dateTime(new Date(value), 'bookingStamp')}</time>
      ) : null;

    case 'bool':
      return value === true ? (
        <Badge variant="success">{t('admin.list.yes')}</Badge>
      ) : (
        <span className="text-content-tertiary">{t('admin.list.no')}</span>
      );

    case 'list':
      return Array.isArray(value) ? (
        <span className="text-body-sm">{format.list(value as string[], 'enumeration')}</span>
      ) : (
        String(value)
      );

    case 'bookingStatus':
      return isMember(bookingStatuses, value) ? (
        <StatusBadge kind="booking" status={value} />
      ) : (
        String(value)
      );

    case 'orderStatus':
      return isMember(orderStatuses, value) ? <StatusBadge kind="order" status={value} /> : String(value);

    case 'paymentStatus':
      return isMember(paymentStatuses, value) ? (
        <StatusBadge kind="payment" status={value} />
      ) : (
        String(value)
      );

    case 'payoutStatus':
      return isMember(payoutStatuses, value) ? (
        <StatusBadge kind="payout" status={value} />
      ) : (
        String(value)
      );

    case 'moderation':
      return isMember(moderationStatuses, value) ? (
        <StatusBadge kind="moderation" status={value} />
      ) : (
        String(value)
      );

    case 'role':
      return typeof value === 'string' && isUserRole(value) ? (
        <Badge variant="metal">{t(userRoleLabelKey(value))}</Badge>
      ) : (
        String(value)
      );

    case 'text':
      return <span className="text-body-sm">{String(value)}</span>;
  }
}

/**
 * Значение из словаря enum. Нужна проверка по массиву значений, а не приведение
 * типа: строка приезжает из БД, и «почти статус» должен показаться как текст, а
 * не уронить страницу обращением к несуществующему цвету.
 */
function isMember<T extends string>(values: readonly T[], value: AdminCellValue): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

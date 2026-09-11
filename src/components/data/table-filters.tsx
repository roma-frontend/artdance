'use client';

/**
 * TABLE FILTERS — поиск, статус и сортировка списка админки.
 *
 * Состояние живёт в URL, а не в React. Причина практическая: администратор
 * пересылает коллеге ссылку «вот эти неопубликованные занятия», нажимает «назад»
 * и ожидает вернуться к тому же отбору, открывает запись и возвращается в список
 * с сохранённым фильтром. Состояние в компоненте не умеет ничего из этого.
 *
 * Форма отправляется обычным `submit` (клавиша Enter работает), а селекты —
 * сразу при выборе: выбрать статус и потом искать кнопку «применить» никто не
 * хочет. Страница при любом изменении сбрасывается на первую — иначе фильтр,
 * сокративший выдачу до двух строк, оставляет человека на пустой седьмой.
 */

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { tableTargetHref, type TableTarget } from '@/components/data/table-target';
import { type AdminListParams } from '@/config';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import type { MessageKey } from '@/i18n/types';

export interface FilterOption {
  value: string;
  labelKey?: MessageKey;
  label?: string;
}

/**
 * Экран, на который ведут фильтры. Описание живёт в `table-target.ts`: тот же
 * адрес строит пагинация, и две копии сборки разошлись бы на первом же
 * параметре.
 */
export type FilterTarget = TableTarget;

interface TableFiltersProps {
  target: FilterTarget;
  /** Показывать поле поиска. */
  searchable?: boolean;
  /** Варианты фильтра статуса. Пустой список — фильтра нет. */
  statusOptions?: readonly FilterOption[];
  /** Варианты сортировки. */
  sortOptions?: readonly FilterOption[];
  /** Родитель, который нельзя терять при смене фильтра. */
  parent?: string;
  /** Раздел экрана с несколькими очередями. */
  tab?: string;
}

export function TableFilters({
  target,
  searchable = true,
  statusOptions = [],
  sortOptions = [],
  parent,
  tab,
}: TableFiltersProps) {
  const t = useTranslations('admin.list');
  /** Узкая подпись: ключ приходит переменной, см. `@/i18n/translate`. */
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentQuery = params.get('q') ?? '';
  const currentStatus = params.get('status') ?? '';
  const currentSort = params.get('sort') ?? '';

  /** Новый адрес списка. Страница всегда сбрасывается, родитель всегда сохраняется. */
  function hrefWith(patch: { q?: string; status?: string; sort?: string }): string {
    const params: AdminListParams = {
      q: patch.q ?? currentQuery,
      status: patch.status ?? currentStatus,
      sort: patch.sort ?? currentSort,
      ...(parent ? { parent } : {}),
      ...(tab ? { tab } : {}),
    };

    return tableTargetHref(target, params);
  }

  function go(href: string): void {
    startTransition(() => router.push(href));
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get('q');
        go(hrefWith({ q: typeof value === 'string' ? value : '' }));
      }}
    >
      {searchable ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="admin-list-search" className="text-label uppercase text-content-secondary">
            {t('searchLabel')}
          </label>
          <input
            id="admin-list-search"
            name="q"
            type="search"
            defaultValue={currentQuery}
            placeholder={t('searchPlaceholder')}
            className="form-input min-w-56"
          />
        </div>
      ) : null}

      {statusOptions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="admin-list-status" className="text-label uppercase text-content-secondary">
            {t('statusLabel')}
          </label>
          <select
            id="admin-list-status"
            name="status"
            defaultValue={currentStatus}
            className="form-input"
            onChange={(event) => go(hrefWith({ status: event.target.value }))}
          >
            <option value="">{t('statusAll')}</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label ?? (option.labelKey ? tRoot(option.labelKey) : option.value)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {sortOptions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="admin-list-sort" className="text-label uppercase text-content-secondary">
            {t('sortLabel')}
          </label>
          <select
            id="admin-list-sort"
            name="sort"
            defaultValue={currentSort}
            className="form-input"
            onChange={(event) => go(hrefWith({ sort: event.target.value }))}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label ?? (option.labelKey ? tRoot(option.labelKey) : option.value)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {t('applyFilters')}
      </Button>
    </form>
  );
}

/**
 * TABLE PAGINATION — страницы списка админки.
 *
 * Ссылки, а не кнопки: страница — это адрес. Отсюда работают «открыть в новой
 * вкладке», индексация внутренних инструментов и кнопка «назад». Компонент
 * серверный: у него нет состояния, только текущий номер и общее число.
 *
 * Границы диапазона считаются здесь, а не в вызывающем экране, потому что
 * «страница 3 из 3» и «страница 4 из 3» — разные ошибки, и обе появляются, когда
 * каждый список считает границы сам.
 */

import { getTranslations } from 'next-intl/server';

import { tableTargetHref, type TableTarget } from '@/components/data/table-target';
import { Button } from '@/components/ui/button';
import { type AdminListParams } from '@/config';
import { Link } from '@/i18n/routing';

interface TablePaginationProps {
  /** Экран, на который ведут ссылки страниц. Тот же, что у панели фильтров. */
  target: TableTarget;
  page: number;
  pageCount: number;
  total: number;
  /** Фильтры, которые нельзя потерять при переходе на другую страницу. */
  query: AdminListParams;
}

export async function TablePagination({ target, page, pageCount, total, query }: TablePaginationProps) {
  const t = await getTranslations('admin.list');

  const current = Math.min(Math.max(page, 1), Math.max(pageCount, 1));
  const hasPrevious = current > 1;
  const hasNext = current < pageCount;

  return (
    <nav
      aria-label={t('pageOf', { page: current, pages: Math.max(pageCount, 1) })}
      className="flex flex-col gap-3 rounded-2xl border border-border-default bg-surface-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-body-sm text-content-secondary">{t('resultsCount', { count: total })}</p>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <p className="rounded-full bg-surface-sunken px-3 py-1.5 text-caption font-semibold text-content-tertiary">
          {t('pageOf', { page: current, pages: Math.max(pageCount, 1) })}
        </p>

        <div className="flex gap-2">
          <Button asChild={hasPrevious} variant="outline" size="sm" disabled={!hasPrevious} className="rounded-full">
            {hasPrevious ? (
              <Link href={tableTargetHref(target, { ...query, page: current - 1 })} rel="prev">
                ← {t('previousPage')}
              </Link>
            ) : (
              <span>← {t('previousPage')}</span>
            )}
          </Button>

          <Button asChild={hasNext} variant="accent" size="sm" disabled={!hasNext} className="rounded-full">
            {hasNext ? (
              <Link href={tableTargetHref(target, { ...query, page: current + 1 })} rel="next">
                {t('nextPage')} →
              </Link>
            ) : (
              <span>{t('nextPage')} →</span>
            )}
          </Button>
        </div>
      </div>
    </nav>
  );
}

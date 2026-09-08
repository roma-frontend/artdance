/**
 * CATALOG PAGINATION — страницы листинга ссылками.
 *
 * Ссылки, а не кнопки с обработчиком: `?page=3` обязан открываться по прямому
 * адресу, работать в кнопке «назад» и попадать в индекс. По этой же причине
 * компонент серверный — клиентского состояния у пагинации нет вообще.
 *
 * Номер страницы переносится в URL, а фильтры сохраняются: пагинация,
 * сбрасывающая фильтр, — распространённая и очень заметная ошибка.
 *
 * `rel="prev"`/`rel="next"` стоят не для красоты: по ним поисковик понимает, что
 * это одна серия страниц, а не десять почти одинаковых документов.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import type { ShopParams } from '@/config/routes';
import { catalogQueryToParams, paginationWindow, type CatalogQuery } from '@/domain/catalog';
import type { CatalogPage } from '@/domain/content';
import { Link } from '@/i18n/routing';

interface CatalogPaginationProps<T> {
  query: CatalogQuery;
  result: CatalogPage<T>;
  buildHref: (params: ShopParams) => string;
}

export function CatalogPagination<T>({ query, result, buildHref }: CatalogPaginationProps<T>) {
  const t = useTranslations();

  /** Одна страница — пагинация только занимает место. */
  if (result.pageCount <= 1) return null;

  /** Первая страница без параметра: у неё один канонический адрес. */
  const href = (page: number): string =>
    buildHref(catalogQueryToParams(query, { page: page === 1 ? undefined : page }));

  const pages = paginationWindow(result.page, result.pageCount);

  return (
    <div className="mt-12">
      <Pagination label={t('a11y.paginationNav')}>
        <PaginationContent>
          {result.page > 1 && (
            <PaginationItem>
              <PaginationLink asChild size="default" className="gap-1 px-2.5">
                <Link href={href(result.page - 1)} rel="prev" aria-label={t('common.actions.back')}>
                  <ChevronLeft aria-hidden className="size-4" />
                  <span className="hidden sm:block">{t('common.actions.back')}</span>
                </Link>
              </PaginationLink>
            </PaginationItem>
          )}

          {pages.map((page, index) =>
            page === null ? (
              <PaginationItem key={`gap-${index === 0 ? 'start' : 'end'}`}>
                <PaginationEllipsis label={t('common.actions.showMore')} />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink asChild isActive={page === result.page}>
                  <Link href={href(page)} aria-label={t('a11y.goToPage', { page })}>
                    {page}
                  </Link>
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          {result.page < result.pageCount && (
            <PaginationItem>
              <PaginationLink asChild size="default" className="gap-1 px-2.5">
                <Link href={href(result.page + 1)} rel="next" aria-label={t('common.actions.next')}>
                  <span className="hidden sm:block">{t('common.actions.next')}</span>
                  <ChevronRight aria-hidden className="size-4" />
                </Link>
              </PaginationLink>
            </PaginationItem>
          )}
        </PaginationContent>
      </Pagination>

      {/* «Страница 2 из 5»: без подписи положение в списке видно только по цвету. */}
      <p className="text-caption mt-4 text-center text-content-tertiary">
        {t('catalog.pagination.summary', { page: result.page, total: result.pageCount })}
      </p>
    </div>
  );
}

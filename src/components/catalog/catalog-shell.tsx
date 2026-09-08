/**
 * CATALOG SHELL — общая обвязка листинга.
 *
 * Шесть разделов каталога отличаются карточкой и сеткой; всё остальное у них
 * одинаково: счётчик найденного, фильтры, сортировка, пустое состояние,
 * пагинация. Оболочка держит это «остальное» в одном месте — иначе шесть
 * страниц разойдутся в поведении, и разойдутся не сразу, а через месяц, когда
 * кто-то поправит пустое состояние в одной из них.
 *
 * Сетка карточек остаётся у страницы: у товаров четыре колонки, у площадок три,
 * у занятий эластичная лента. Пытаться описать это пропсом означало бы
 * `columns={{ sm: 2, lg: 4 }}` — то есть переписать Tailwind хуже, чем он есть.
 *
 * Пустое состояние подставляется вместо содержимого, а не рядом с ним: список из
 * нуля карточек и объяснение под ним читаются как «загружается».
 */

import { SearchX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { CatalogPagination } from '@/components/catalog/catalog-pagination';
import { DiscoverFilters, type FilterFacets } from '@/components/catalog/discover-filters';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { listingRoute, type ListingSection } from '@/config/routes';
import { hasActiveFilters, type CatalogQuery, type CatalogSort } from '@/domain/catalog';
import type { CatalogPage } from '@/domain/content';
import { Link } from '@/i18n/routing';

interface CatalogShellProps<T> {
  query: CatalogQuery;
  result: CatalogPage<T>;
  /** Фасеты фильтров. Пустой объект означает листинг без фильтров. */
  facets: FilterFacets;
  sorts: readonly CatalogSort[];
  /**
   * Какой это раздел каталога. Отсюда берётся адрес всех ссылок оболочки:
   * фильтров, сортировки, сброса и страниц.
   *
   * Раньше страница передавала `buildHref={(next) => routes.classes(next)}`.
   * Так нельзя: фильтры — клиентский компонент, а функция через границу
   * сервер/клиент не проходит. Плюс одно значение вместо пяти одинаковых
   * замыканий в пяти страницах.
   */
  section: ListingSection;
  /** Сетка карточек: её задаёт страница, а не оболочка. */
  children: ReactNode;
}

export function CatalogShell<T>({
  query,
  result,
  facets,
  sorts,
  section,
  children,
}: CatalogShellProps<T>) {
  const t = useTranslations();
  const filtered = hasActiveFilters(query);
  const buildHref = listingRoute[section];

  return (
    <div className="page-container py-12 md:py-16">
      <DiscoverFilters
        query={query}
        facets={facets}
        sorts={sorts}
        section={section}
        total={result.total}
        className="mb-10"
      />

      {result.total === 0 ? (
        <EmptyState
          icon={<SearchX aria-hidden className="size-8" />}
          title={filtered ? t('catalog.empty.title') : t('common.states.empty')}
          description={
            filtered ? t('catalog.empty.description') : t('common.states.noResultsHint')
          }
          action={
            filtered && (
              <Button asChild variant="outline">
                <Link href={buildHref({})}>{t('catalog.filters.reset')}</Link>
              </Button>
            )
          }
        />
      ) : (
        children
      )}

      <CatalogPagination query={query} result={result} buildHref={buildHref} />
    </div>
  );
}

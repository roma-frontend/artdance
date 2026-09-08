'use client';

/**
 * DISCOVER FILTERS — фильтры и сортировка листинга.
 *
 * **Состояние живёт в URL, а не в React.** Это требование продукта: ссылка на
 * отфильтрованный список обязана открываться у другого человека, попадать в
 * индекс и работать в кнопке «назад». Поэтому каждый чип — обычная ссылка
 * (`<Link>`), а не кнопка с обработчиком: она открывается в новой вкладке,
 * копируется правой кнопкой и работает без JavaScript.
 *
 * Клиентским компонент делает ровно одно: шторка фильтров на узком экране. Сами
 * значения фильтров приходят пропсами с сервера и в браузер не считаются.
 *
 * **В прототипе фильтры на 360px исчезают** (`display: none !important`). Здесь
 * они уходят в `Sheet` с ловушкой фокуса: на телефоне каталог без фильтров
 * бесполезен, а «спрятать сложное на мобильном» — это не адаптивность.
 *
 * Сортировка — ссылка в выпадающем меню, а не `<select>`: `select` не умеет
 * навигацию без JavaScript, а меню из ссылок умеет.
 */

import { SlidersHorizontal, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { listingRoute, type ListingSection } from '@/config/routes';
import {
  activeFilterCount,
  catalogQueryToParams,
  catalogSortLabelKey,
  hasActiveFilters,
  skillLevelSlug,
  type CatalogQuery,
  type CatalogSort,
} from '@/domain/catalog';
import type { FacetOption } from '@/domain/content';
import { danceStyleSlug, type SkillLevel } from '@/domain/enums';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * Набор фильтров конкретного листинга.
 *
 * Отсутствие группы означает, что этот листинг её не поддерживает: у площадки
 * нет уровня, у товара нет района. Пустой массив и `undefined` различаются — в
 * первом случае фильтр есть, но значений нет (и группа не рисуется тоже, но по
 * другой причине: фильтровать нечем).
 */
export interface FilterFacets {
  styles?: readonly FacetOption[];
  levels?: readonly FacetOption[];
  districts?: readonly FacetOption[];
  categories?: readonly FacetOption[];
}

interface DiscoverFiltersProps {
  query: CatalogQuery;
  facets: FilterFacets;
  /** Варианты сортировки, которые листинг умеет считать (`availableSorts`). */
  sorts: readonly CatalogSort[];
  /**
   * Раздел, в котором стоят фильтры: из него берётся адрес ссылок.
   *
   * Значение, а не функция `(params) => string`, и причина техническая: этот
   * компонент клиентский, а функцию через границу сервер/клиент передать нельзя.
   * Раздел сериализуется, а маршрут по нему собирает `listingRoute` — то есть
   * по-прежнему `routes`, а не склейка строк.
   */
  section: ListingSection;
  /** Сколько найдено — подпись рядом с фильтрами. */
  total: number;
  className?: string;
}

export function DiscoverFilters({
  query,
  facets,
  sorts,
  section,
  total,
  className,
}: DiscoverFiltersProps) {
  const t = useTranslations();
  const format = useFormatter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const buildHref = listingRoute[section];
  const applied = activeFilterCount(query);
  const groups = <FilterGroups query={query} facets={facets} section={section} />;

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {/* ── Панель управления: количество, сортировка, кнопка шторки ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-content-secondary" aria-live="polite">
          {t('common.counts.results', { count: total })}
        </p>

        <div className="flex items-center gap-2">
          {/* Кнопка шторки видна только там, где фильтры не помещаются в строку. */}
          {hasAnyFacet(facets) && (
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <SlidersHorizontal aria-hidden className="size-4" />
                  {t('catalog.filters.openCta')}
                  {applied > 0 && (
                    <Badge variant="accent" className="ml-1">
                      {format.number(applied)}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>

              <SheetContent side="right" closeLabel={t('common.actions.close')}>
                <SheetHeader>
                  <SheetTitle>{t('catalog.filters.title')}</SheetTitle>
                  <SheetDescription>
                    {t('a11y.selectedFilterCount', { count: applied })}
                  </SheetDescription>
                </SheetHeader>

                <div className="overflow-y-auto px-4 pb-8">{groups}</div>
              </SheetContent>
            </Sheet>
          )}

          <SortMenu query={query} sorts={sorts} section={section} />
        </div>
      </div>

      {/* ── Фильтры в строку: на широком экране они всегда на виду ── */}
      {hasAnyFacet(facets) && <div className="hidden lg:block">{groups}</div>}

      {/* ── Сброс: без явного выхода узкий фильтр становится тупиком ── */}
      {hasActiveFilters(query) && (
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link href={buildHref({})}>
              <X aria-hidden className="size-4" />
              {t('catalog.filters.reset')}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function hasAnyFacet(facets: FilterFacets): boolean {
  return [facets.styles, facets.levels, facets.districts, facets.categories].some(
    (group) => group !== undefined && group.length > 0,
  );
}

/* ─────────────────────────── Группы чипов ─────────────────────────── */

function FilterGroups({
  query,
  facets,
  section,
}: Pick<DiscoverFiltersProps, 'query' | 'facets' | 'section'>) {
  const t = useTranslations();
  const buildHref = listingRoute[section];

  return (
    <div className="flex flex-col gap-5">
      {facets.styles && facets.styles.length > 0 && (
        <FilterGroup
          legend={t('common.labels.style')}
          allLabel={t('catalog.filters.allStyles')}
          allHref={buildHref(catalogQueryToParams(query, { style: undefined }))}
          isAllActive={query.style === undefined}
          options={facets.styles}
          isActive={(value) => query.style !== undefined && danceStyleSlug(query.style) === value}
          hrefFor={(value) => buildHref(catalogQueryToParams(query, { style: value }))}
        />
      )}

      {facets.levels && facets.levels.length > 0 && (
        <FilterGroup
          legend={t('common.labels.level')}
          allLabel={t('catalog.filters.allLevels')}
          allHref={buildHref(catalogQueryToParams(query, { level: undefined }))}
          isAllActive={query.level === undefined}
          options={facets.levels}
          isActive={(value) => query.level === value}
          hrefFor={(value) =>
            buildHref(catalogQueryToParams(query, { level: skillLevelSlug(value as SkillLevel) }))
          }
        />
      )}

      {facets.districts && facets.districts.length > 0 && (
        <FilterGroup
          legend={t('catalog.filters.district')}
          allLabel={t('catalog.filters.allDistricts')}
          allHref={buildHref(catalogQueryToParams(query, { district: undefined }))}
          isAllActive={query.district === undefined}
          options={facets.districts}
          isActive={(value) => query.district === value}
          hrefFor={(value) => buildHref(catalogQueryToParams(query, { district: value }))}
        />
      )}

      {facets.categories && facets.categories.length > 0 && (
        <FilterGroup
          legend={t('shop.categoriesTitle')}
          allLabel={t('catalog.filters.allCategories')}
          allHref={buildHref(catalogQueryToParams(query, { category: undefined }))}
          isAllActive={query.category === undefined}
          options={facets.categories}
          isActive={(value) => query.category === value}
          hrefFor={(value) => buildHref(catalogQueryToParams(query, { category: value }))}
        />
      )}
    </div>
  );
}

interface FilterGroupProps {
  legend: string;
  allLabel: string;
  allHref: string;
  isAllActive: boolean;
  options: readonly FacetOption[];
  isActive: (value: string) => boolean;
  hrefFor: (value: string) => string;
}

/**
 * Группа чипов одного фильтра.
 *
 * `fieldset`/`legend`, а не `div` с заголовком: скринридер объявляет назначение
 * группы перед каждым чипом, и «Salsa» перестаёт быть просто словом в списке
 * ссылок.
 *
 * Активный чип помечается `aria-current="page"`, потому что он и есть текущая
 * страница — тот же приём, что у активного раздела в шапке. Цвет как
 * единственный признак выбранного фильтра не годится.
 */
function FilterGroup({
  legend,
  allLabel,
  allHref,
  isAllActive,
  options,
  isActive,
  hrefFor,
}: FilterGroupProps) {
  const t = useTranslations();
  const format = useFormatter();

  return (
    <fieldset className="min-w-0">
      <legend className="text-eyebrow mb-2 text-content-tertiary">{legend}</legend>

      <ul className="flex flex-wrap gap-2">
        <li>
          <FilterChip href={allHref} active={isAllActive}>
            {allLabel}
          </FilterChip>
        </li>

        {options.map((option) => (
          <li key={option.value}>
            <FilterChip href={hrefFor(option.value)} active={isActive(option.value)}>
              {/*
                Подпись направления и уровня — ключ i18n; подпись района и
                категории — данные заказчика. Различить их можно по форме ключа:
                у словарного ключа есть точка, у названия из базы — нет.
              */}
              {option.labelKey.includes('.')
                ? t(option.labelKey as 'danceStyles.hipHop')
                : option.labelKey}
              <span className="text-2xs text-content-tertiary">{format.number(option.count)}</span>
            </FilterChip>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      /*
       * Геометрия и кегль — от `.tag` прототипа (0.65rem / 600, скруглён
       * полностью). Отличие одно: у чипа есть состояния наведения и фокуса,
       * потому что в продукте это ссылка, а в макете — надпись.
       */
      className={cn(
        'text-2xs inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold',
        'transition-colors duration-200 ease-brand',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
        active
          ? 'bg-accent text-content-on-accent'
          : 'bg-surface-sunken text-content-secondary hover:bg-accent-soft hover:text-content-accent',
      )}
    >
      {children}
    </Link>
  );
}

/* ─────────────────────────── Сортировка ─────────────────────────── */

/**
 * Сортировка — меню из ссылок.
 *
 * Ссылки, а не `<select>` с обработчиком: `select` не умеет навигацию без
 * JavaScript и не открывается в новой вкладке, а порядок результатов — часть
 * адреса страницы. Меню взято из существующего примитива, а не написано на
 * `details`: у Radix есть возврат фокуса на триггер, закрытие по Esc и по клику
 * вне — три вещи, которые в самодельном варианте обычно забывают.
 */
function SortMenu({
  query,
  sorts,
  section,
}: Pick<DiscoverFiltersProps, 'query' | 'sorts' | 'section'>) {
  const t = useTranslations();
  const buildHref = listingRoute[section];

  if (sorts.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <span className="text-content-tertiary">{t('catalog.sort.label')}</span>
          {t(catalogSortLabelKey(query.sort))}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-56">
        {sorts.map((sort) => (
          <DropdownMenuItem key={sort} asChild>
            <Link
              href={buildHref(catalogQueryToParams(query, { sort }))}
              aria-current={sort === query.sort ? 'page' : undefined}
              className={cn(sort === query.sort && 'font-semibold text-content-accent')}
            >
              {t(catalogSortLabelKey(sort))}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

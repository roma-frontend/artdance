/**
 * HERO SEARCH BAR — поисковая строка, наезжающая на первый экран.
 *
 * Это же место со временем станет входом в ассистента: строка «что хочешь
 * танцевать» — естественная точка для разговора, а не только для поиска по
 * подстроке. Поэтому запрос уходит в URL (`routes.discover({ q })`), а не в
 * состояние компонента: ссылка на результат должна открываться у другого
 * человека, индексироваться и одинаково работать для поиска и для ассистента.
 *
 * Форма настоящая: `<form>` с `submit`, а не кнопка с обработчиком. Тогда
 * Enter в поле работает сам, а без JavaScript строка остаётся рабочей ссылкой
 * на каталог.
 *
 * Чипы города, даты и направления — пока подписи текущего выбора, а не кнопки.
 * Это осознанно: полноценные фильтры приходят с `DiscoverFilters` в волне
 * каталога, и до тех пор кнопка, которая ничего не открывает, была бы хуже
 * подписи. В макете на 360px чипы просто исчезают (`display: none !important`) —
 * у нас они переносятся на вторую строку и остаются видимыми.
 */

'use client';

import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { routes, site } from '@/config';
import { useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export function HeroSearchBar({ className }: { className?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [query, setQuery] = useState('');

  return (
    <form
      /*
       * Отрицательный отступ сверху — «наезд» на hero из макета. Значение из
       * шкалы отступов, а не подобранное на глаз.
       */
      className={cn('page-container relative z-20 -mt-15', className)}
      action={routes.discover()}
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = query.trim();
        router.push(trimmed.length > 0 ? routes.discover({ q: trimmed }) : routes.discover());
      }}
    >
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-xl p-2',
          'border border-border-default bg-surface-card shadow-lg',
        )}
      >
        <label className="flex min-w-0 flex-1 items-center gap-2 px-3">
          <SearchIcon className="size-4 shrink-0 text-content-tertiary" aria-hidden />
          <span className="sr-only">{t('search.heroPlaceholder')}</span>
          <input
            type="search"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search.heroPlaceholder')}
            className={cn(
              'text-body-sm w-full min-w-0 bg-transparent py-2.5 text-content-primary',
              'outline-none placeholder:text-content-tertiary',
            )}
          />
        </label>

        <span aria-hidden className="hidden h-8 w-px shrink-0 bg-border-default sm:block" />

        {/*
          Подписи текущего выбора. Город берётся из конфигурации площадки, а не
          пишется строкой: у платформы один город на старте, и когда их станет
          больше, значение придёт оттуда же.
        */}
        <ul className="text-caption flex flex-wrap items-center gap-1 text-content-secondary">
          <li className="rounded-full bg-accent-soft px-3 py-2 font-semibold text-content-accent">
            {site.address.city}
          </li>
          <li className="rounded-full px-3 py-2">{t('search.anyDate')}</li>
          <li className="rounded-full px-3 py-2">{t('search.anyStyle')}</li>
        </ul>

        <Button type="submit" size="md" className="max-sm:w-full">
          {t('common.actions.explore')}
        </Button>
      </div>
    </form>
  );
}

/**
 * SITE HEADER — фиксированная шапка сайта.
 *
 * Два состояния, как в прототипе:
 *   • `top`      — прозрачная, светлый текст: шапка лежит поверх тёмного hero;
 *   • `scrolled` — фон канвы, размытие и уменьшенная высота.
 *
 * Состояние зависит не от порога прокрутки, а от того, лежит ли за шапкой
 * кинематографичный первый экран. Прежде это был порог из прототипа — 60
 * пикселей, — и он работал, пока первый экран уезжал вверх сразу. С раскрытием
 * занавеса экран приколот на две высоты окна, и порог красил шапку в цвет канвы,
 * когда за ней ещё тёмный театр: светлая полоса поверх кадра. Список страниц с
 * таким первым экраном — в `hasCinemaHero`; сам факт «кадр ещё за шапкой» меряется
 * по обёртке экрана, поэтому компонент не знает, что на главной нарисовано.
 *
 * Клиентский компонент: положение скролла известно только в браузере. Всё
 * остальное — ссылки, иконки, ключи переводов — приходит из `@/config`, поэтому
 * здесь нет ни одного пути, ни одной подписи и ни одного цвета.
 *
 * Состояние `authenticated` (аватар и меню аккаунта вместо иконки входа) придёт
 * с волной аутентификации отдельным клиентским островком в `nav-right`: чтение
 * сессии — обращение к БД, и делать его в шапке значило бы отключить статическую
 * генерацию у каждой страницы сайта.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useRef, type MouseEvent } from 'react';

import { BrandMark } from '@/components/brand/brand-mark';
import { navIcons } from '@/components/layout/nav-icons';
import { useSearchOverlay } from '@/components/search/search-overlay';
import { Button } from '@/components/ui/button';
import { LinkPending } from '@/components/ui/link-pending';
import {
  hasCinemaHero,
  headerCta,
  headerIconItems,
  isActiveNavPath,
  primaryNavItems,
  routes,
} from '@/config';
import { Link, usePathname } from '@/i18n/routing';
import { useCinemaHeroBehind } from '@/lib/hooks/use-cinema-hero-behind';
import { cn } from '@/lib/utils';

export function SiteHeader() {
  const t = useTranslations();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const heroBehind = useCinemaHeroBehind(headerRef, hasCinemaHero(pathname));
  const { openSearch } = useSearchOverlay();

  const solid = !heroBehind;

  return (
    <header
      ref={headerRef}
      data-state={solid ? 'scrolled' : 'top'}
      className={cn(
        'fixed inset-x-0 top-0 z-header border-b',
        'transition-colors duration-slow ease-standard',
        solid
          ? 'border-border-default bg-surface-canvas/85 backdrop-blur-xl'
          : 'border-transparent bg-transparent',
      )}
    >
      <div
        className={cn(
          'page-container flex items-center justify-between gap-6',
          'transition-all duration-slow ease-standard',
          solid ? 'py-3' : 'py-5',
        )}
      >
        <Link href={routes.home()} className="group/logo flex items-center gap-3">
          {/*
            Знак бренда следует той же логике, что и словесная марка: над
            кинематографичным первым экраном бургунди на почти чёрном
            практически не виден, поэтому там берётся осветлённый акцент.
          */}
          <BrandMark
            className={cn(
              'transition-transform duration-slow ease-brand group-hover/logo:-rotate-12',
              solid ? 'text-content-accent' : 'text-accent-on-cinema',
            )}
          />
          <span
            /*
             * Марка бренда не переводится: авто-переводчик Chrome на армянской и
             * русской версиях иначе выдаёт «ArtDance» транслитерацией.
             */
            translate="no"
            className={cn(
              'text-card-title transition-colors duration-slow ease-standard',
              solid ? 'text-content-primary' : 'text-content-on-cinema',
            )}
          >
            {t('brand.name')}
          </span>
        </Link>

        <nav aria-label={t('a11y.mainNav')} className="hidden items-center gap-7 lg:flex">
          {primaryNavItems.map((item) => {
            const active = isActiveNavPath(pathname, item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'nav-link text-label transition-colors duration-normal ease-brand',
                  solid
                    ? active
                      ? 'text-content-primary'
                      : 'text-content-secondary hover:text-content-primary'
                    : active
                      ? 'text-content-on-cinema'
                      : 'text-content-on-cinema-muted hover:text-content-on-cinema',
                )}
              >
                {t(item.labelKey)}
                <LinkPending />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {headerIconItems.map((item) => {
            const Icon = navIcons[item.icon];
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-label={t(item.labelKey)}
                /*
                 * Поиск открывается оверлеем, но остаётся ссылкой на каталог:
                 * без JavaScript переход сработает как обычно, с JavaScript
                 * `preventDefault` подменяет его полноэкранным поиском.
                 * `aria-haspopup` сообщает скринридеру, что откроется диалог.
                 */
                {...(item.opensSearch
                  ? {
                      'aria-haspopup': 'dialog' as const,
                      onClick: (event: MouseEvent<HTMLAnchorElement>) => {
                        event.preventDefault();
                        openSearch();
                      },
                    }
                  : {})}
                className={cn(
                  'inline-flex size-9 items-center justify-center rounded-full border border-transparent',
                  'transition-colors duration-normal ease-brand',
                  /* Не помещающиеся иконки уходят в мобильное меню, а не исчезают. */
                  item.compact ? undefined : 'max-lg:hidden',
                  solid
                    ? 'text-content-secondary hover:border-accent hover:bg-accent-soft hover:text-content-accent'
                    : 'text-content-on-cinema-muted hover:border-border-on-cinema hover:text-content-on-cinema',
                )}
              >
                <Icon className="size-5" aria-hidden />
              </Link>
            );
          })}

          <Button asChild size="sm" className="max-lg:hidden text-sm">
            <Link href={headerCta.href}>{t(headerCta.labelKey)}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

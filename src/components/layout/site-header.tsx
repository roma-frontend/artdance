/**
 * SITE HEADER — фиксированная шапка сайта.
 *
 * Два состояния, как в прототипе:
 *   • `top`      — прозрачная, светлый текст: шапка лежит поверх тёмного hero;
 *   • `scrolled` — фон канвы, размытие и уменьшенная высота.
 *
 * Состояние зависит не только от скролла: на страницах без кинематографичного
 * первого экрана шапка сплошная сразу, иначе тёмный текст лёг бы на светлый фон.
 * Список таких страниц — в `hasCinemaHero`, компонент не знает, что нарисовано
 * на главной.
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

import { HeartIcon, SearchIcon, ShoppingBagIcon, UserIcon, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { BrandMark } from '@/components/brand/brand-mark';
import { MobileNavDrawer } from '@/components/layout/mobile-nav-drawer';
import { Button } from '@/components/ui/button';
import {
  hasCinemaHero,
  headerCta,
  headerIconItems,
  isActiveNavPath,
  primaryNavItems,
  routes,
  type NavIconName,
} from '@/config';
import { motion } from '@/design/motion';
import { Link, usePathname } from '@/i18n/routing';
import { useScrolledPast } from '@/lib/hooks/use-scrolled-past';
import { cn } from '@/lib/utils';

/** Реестр иконок: конфигурация хранит имя, компонент подставляется здесь. */
const navIcons: Record<NavIconName, LucideIcon> = {
  search: SearchIcon,
  cart: ShoppingBagIcon,
  favorites: HeartIcon,
  account: UserIcon,
};

export function SiteHeader() {
  const t = useTranslations();
  const pathname = usePathname();
  const scrolledPast = useScrolledPast(motion.headerScroll.thresholdPx);

  const solid = scrolledPast || !hasCinemaHero(pathname);

  return (
    <header
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
          <BrandMark className="text-accent transition-transform duration-slow ease-brand group-hover/logo:-rotate-12" />
          <span
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
                className={cn(
                  'inline-flex size-9 items-center justify-center rounded-full border border-transparent',
                  'transition-colors duration-normal ease-brand',
                  /* Не помещающиеся иконки уходят в мобильное меню, а не исчезают. */
                  item.compact ? undefined : 'max-lg:hidden',
                  solid
                    ? 'text-content-secondary hover:border-accent hover:bg-accent-soft hover:text-accent'
                    : 'text-content-on-cinema-muted hover:border-border-on-cinema hover:text-content-on-cinema',
                )}
              >
                <Icon className="size-5" aria-hidden />
              </Link>
            );
          })}

          <Button asChild size="sm" className="max-lg:hidden">
            <Link href={headerCta.href}>{t(headerCta.labelKey)}</Link>
          </Button>

          <MobileNavDrawer solid={solid} className="lg:hidden" />
        </div>
      </div>
    </header>
  );
}

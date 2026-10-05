/**
 * SITE HEADER — умная шапка как в Desktop/hr-project.
 *
 * Идея hr-project: центр — пилюля с разделами, шапка не «перекрашивается»
 * на скачке высоты, а меняет плотность. У нас та же задача + кинематографичный
 * hero на главной.
 *
 * Вверху — полная прозрачная шапка, вниз — скрытие всей текущей формы,
 * вверх — компактный стеклянный остров. У начала страницы остров плавно
 * раскрывается обратно. Фиксированная рама не сдвигает контент.
 * При открытом мега-меню или фокусе внутри шапка не прячется.
 *
 * Цвет и фон — из токенов, без произвольных значений и без text-[]. Состояние
 * «герой за шапкой» меряет useCinemaHeroBehind по геометрии, а не по порогу.
 */

'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';

import { useCartStore } from '@/lib/cart/store';
import { fetchCart } from '@/lib/cart/api';
import { useHeaderHideOnScroll } from '@/lib/hooks/use-header-hide-on-scroll';

import { BrandMark } from '@/components/brand/brand-mark';
import { ScrollProgress } from '@/components/fx/scroll-progress';
import { HeaderMegaMenu } from '@/components/layout/header-mega-menu';
import { useIsLiteMode } from '@/lib/perf/lite-mode';
import { HeaderLiteToggle } from '@/components/layout/header-lite-toggle';
import { HeaderThemeToggle } from '@/components/layout/header-theme-toggle';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { navIcons } from '@/components/layout/nav-icons';
import { useSearchOverlay } from '@/components/search/search-overlay';
import { Button } from '@/components/ui/button';
import { hasCinemaHero, headerCta, headerIconItems, routes } from '@/config';
import { Link, usePathname } from '@/i18n/routing';
import { useCinemaHeroBehind } from '@/lib/hooks/use-cinema-hero-behind';
import { cn } from '@/lib/utils';

export function SiteHeader() {
  const t = useTranslations();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const heroBehind = useCinemaHeroBehind(headerRef, hasCinemaHero(pathname));
  const { openSearch } = useSearchOverlay();
  const snapshot = useCartStore((s) => s.snapshot);
  const [bump, setBump] = useState(false);
  const prevCount = useRef<number>(snapshot?.totals.itemCount ?? 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const onMenuOpenChange = useCallback((open: boolean) => setMenuOpen(open), []);
  const lite = useIsLiteMode();
  // island-компакт доступен на всех страницах (не только на главной):
  // пользователь ожидает один язык шапки после навигации, а не «на главной остров есть, внутри — нет»
  const { hidden, island } = useHeaderHideOnScroll(headerRef, menuOpen, true, pathname);

  // мега-меню и фокус внутри шапки не должны оставаться после клиентской навигации —
  // иначе header остаётся в paused и не компактится до перезагрузки/blur
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс меню при смене маршрута
    setMenuOpen(false);
    if (headerRef.current?.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // next-intl скроллит к верху асинхронно — даём тик на scroll-restoration
    const id = requestAnimationFrame(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!snapshot) {
      void fetchCart()
        .then((s) => {
          if (s) useCartStore.getState().setSnapshot(s);
        })
        .catch(() => {});
    } else {
      const next = snapshot.totals.itemCount;
      if (next !== prevCount.current) {
        prevCount.current = next;
        if (next > 0) {
          timer = setTimeout(() => setBump(false), 420);
          queueMicrotask(() => setBump(true));
        }
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [snapshot]);

  const solid = island || !heroBehind;

  return (
    <header
      ref={headerRef}
      data-state={solid ? 'scrolled' : 'top'}
      data-mode={island ? 'island' : 'full'}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      className={cn('site-header fixed inset-x-0 top-0 z-header will-change-transform', hidden && 'pointer-events-none')}
      style={{ transform: hidden ? 'translateY(calc(-100% - 20px))' : 'translateY(0)' }}
    >
      <div className={cn('site-header-surface relative', solid ? 'border-border-default bg-surface-canvas/85 backdrop-blur-xl' : 'border-transparent bg-transparent')}>
      {!lite && (
        <div
          aria-hidden
          className="scroll-progress-clip pointer-events-none absolute inset-x-0 bottom-0 h-(--scroll-progress-height) overflow-hidden [border-radius:inherit]"
        >
          <ScrollProgress />
        </div>
      )}
      <div className="site-header-content page-container flex h-full items-center justify-between gap-4">
        <Link
          href={routes.home()}
          aria-current={pathname === routes.home() ? 'page' : undefined}
          className="group/logo flex shrink-0 items-center gap-3"
        >
          <BrandMark
            className={cn(
              'transition-transform duration-slow ease-brand group-hover/logo:-rotate-12',
              solid ? 'text-content-accent' : 'text-accent-on-cinema',
            )}
          />
          <span
            translate="no"
            className={cn(
              'text-card-title transition-colors duration-slow ease-standard',
              solid ? 'text-content-primary' : 'text-content-on-cinema',
            )}
          >
            {t('brand.name')}
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 justify-center lg:flex">
          <HeaderMegaMenu solid={solid} onOpenChange={onMenuOpenChange} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {headerIconItems.map((item) => {
            const Icon = navIcons[item.icon];
            const isCart = item.id === 'cart';
            const cartCount = isCart ? (snapshot?.totals.itemCount ?? 0) : 0;
            const showBadge = isCart && cartCount > 0;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-label={showBadge ? `${String(t(item.labelKey))} — ${cartCount}` : String(t(item.labelKey))}
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
                  'relative inline-flex size-9 items-center justify-center rounded-full border',
                  'transition-colors duration-normal ease-brand',
                  item.compact ? undefined : 'site-header-secondary-action max-lg:hidden',
                  solid
                    ? 'border-transparent text-content-secondary hover:border-accent hover:bg-accent-soft hover:text-content-accent'
                    : 'border-white/10 text-content-on-cinema-muted hover:border-border-on-cinema hover:text-content-on-cinema',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {showBadge && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 py-0.5 text-caption font-bold leading-none text-white',
                      'transition-transform duration-normal ease-brand',
                      bump ? 'scale-110' : 'scale-100',
                    )}
                  >
                    {cartCount > 99 ? '99+' : String(cartCount)}
                  </span>
                )}
              </Link>
            );
          })}

          <LocaleSwitcher solid={solid} />

          <span className="hidden shrink-0 items-center gap-2 lg:flex">
            <HeaderLiteToggle solid={solid} />
            <HeaderThemeToggle solid={solid} />
          </span>

          <Button asChild size="sm" className="max-lg:hidden">
            <Link href={headerCta.href}>
              {t(headerCta.labelKey)}
            </Link>
          </Button>
        </div>
      </div>
      </div>
    </header>
  );
}

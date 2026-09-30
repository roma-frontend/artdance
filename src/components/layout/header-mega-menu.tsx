/**
 * HEADER MEGA MENU — одно меню с сабменюшками (как в hr-project).
 *
 * Desktop: группы в ряд, ховер/фокус раскрывает панель с детьми.
 * Панель — поверх контента, бурдажи-мозаика: blур + граница, как у сайта.
 * Mobile не трогает — там остаётся MobileMenuSheet.
 */

'use client';

import { ChevronDownIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { navIcons } from '@/components/layout/nav-icons';
import { headerMegaGroups, isActiveNavPath } from '@/config/navigation';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';

interface Props {
  solid: boolean;
}

export function HeaderMegaMenu({ solid }: Props) {
  const t = useTranslations();
  const pathname = usePathname();
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const clearTimer = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const scheduleClose = () => {
    clearTimer();
    closeTimer.current = setTimeout(() => setOpenId(null), 140);
  };

  // Esc закрывает, клик вне — закрывает, смена маршрута — закрывает
  // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс меню при навигации
  useEffect(() => { setOpenId(null); }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null); };
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenId(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, []);

  return (
    <nav ref={navRef} aria-label={t('a11y.mainNav')} className="hidden items-center gap-1 lg:flex">
      {headerMegaGroups.map((group: (typeof headerMegaGroups)[number]) => {
        const active = isActiveNavPath(pathname, group.href) || group.children.some((c: (typeof group.children)[number]) => isActiveNavPath(pathname, c.href));
        const open = openId === group.id;
        return (
          <div
            key={group.id}
            className="relative"
            onMouseEnter={() => { clearTimer(); setOpenId(group.id); }}
            onMouseLeave={scheduleClose}
            onFocusCapture={() => { clearTimer(); setOpenId(group.id); }}
            onBlurCapture={(e) => {
              // закрыть только если фокус ушёл за пределы группы
              const next = e.relatedTarget as Node | null;
              if (next && e.currentTarget.contains(next)) return;
              scheduleClose();
            }}
          >
            <Link
              href={group.href}
              data-magnetic=""
              aria-expanded={open}
              aria-haspopup="menu"
              aria-current={active ? 'page' : undefined}
              onClick={(e) => {
                // первый клик на десктопе открывает, второй — переходит
                if (!open) { e.preventDefault(); setOpenId(group.id); }
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); setOpenId(group.id); }
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-label transition-colors duration-normal ease-brand',
                solid
                  ? active ? 'bg-accent-soft text-content-primary' : 'text-content-secondary hover:bg-surface-sunken hover:text-content-primary'
                  : active ? 'bg-white/10 text-content-on-cinema' : 'text-content-on-cinema-muted hover:bg-white/10 hover:text-content-on-cinema',
              )}
            >
              {t(group.labelKey)}
              <ChevronDownIcon className={cn('size-3.5 opacity-60 transition-transform', open && 'rotate-180')} aria-hidden />
            </Link>

            {/* Панель — inert+aria-hidden когда закрыта: иначе axe ругается aria-hidden-focus
                (скрытый блок не должен содержать фокусируемые ссылки). inert убирает
                всё поддерево из порядка табуляции и дерева доступности.
                hidden когда закрыта — иначе абсолютный блок шириной 860, центрированный
                на группе у края экрана, выносит -20px за clientWidth и ломает
                layout-integrity (mobile Chrome расширяет viewport, координаты tap
                съезжают — шесть тестов падали как flaky). display:none исключает
                закрытую панель из getBoundingClientRect, но открытая остаётся
                анимированной через opacity/translate. */}
              <div
                hidden={!open ? true : undefined}
                inert={!open ? true : undefined}
                role="menu"
                aria-hidden={!open}
              className={cn(
                'absolute left-1/2 top-[calc(100%+10px)] z-50 w-[min(860px,92vw)] -translate-x-1/2 rounded-2xl border bg-surface-card shadow-xl backdrop-blur-xl',
                'border-border-default p-3 md:p-4',
                'transition-[opacity,translate] duration-200',
                open ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0',
                solid ? 'bg-surface-card/95' : 'bg-surface-card',
              )}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-eyebrow text-content-tertiary">{t(group.labelKey)}</p>
                <Link href={group.href} onClick={() => setOpenId(null)} className="text-caption font-semibold text-content-accent hover:underline">{t('common.actions.viewAll' as never)}</Link>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {group.children
                  .filter((c: (typeof group.children)[number]) => !c.feature || c.feature === undefined || true)
                  .map((child: (typeof group.children)[number]) => {
                    const Icon: (typeof navIcons)[keyof typeof navIcons] | null = child.icon
                      ? (navIcons as Record<string, (typeof navIcons)[keyof typeof navIcons]>)[child.icon] ?? null
                      : null;
                    const childActive = isActiveNavPath(pathname, child.href);
                    return (
                      <Link
                        key={child.id}
                        href={child.href}
                        role="menuitem"
                        onClick={() => setOpenId(null)}
                        className={cn(
                          'group/item flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors',
                          childActive ? 'bg-accent-soft text-content-accent' : 'hover:bg-surface-sunken text-content-primary',
                        )}
                      >
                        {Icon && (
                          <span className={cn('mt-0.5 grid size-8 place-items-center rounded-lg', childActive ? 'bg-accent text-white' : 'bg-surface-sunken text-content-tertiary group-hover/item:bg-surface-card')}>
                            <Icon className="size-4" aria-hidden />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block text-body-sm font-semibold leading-none">{t(child.labelKey)}</span>
                          {child.descriptionKey && (
                            <span className="mt-1 block text-caption leading-tight text-content-tertiary">{t(child.descriptionKey)}</span>
                          )}
                        </span>
                      </Link>
                    );
                  })}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

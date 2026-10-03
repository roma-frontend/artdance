/**
 * HEADER MEGA MENU — пилюля-навбар как в Desktop/hr-project.
 *
 * Desktop: группы в ряд внутри скруглённой пилюли, ховер/фокус раскрывает
 * панель с детьми. Панель — поверх контента, blur + граница, как у сайта.
 * Mobile не трогает — там остаётся MobileMenuSheet через MobileDock.
 *
 * Анимация появления/исчезновения — без скачка на выходе: панель остаётся
 * в DOM на время ухода, поэтому закрытие — плавный fade+сдвиг, а не пропажа.
 */

'use client';

import { ChevronDownIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { navIcons } from '@/components/layout/nav-icons';
import { headerMegaGroups, isActiveNavPath } from '@/config/navigation';
import { Link, usePathname } from '@/i18n/routing';
import { useMegaMenuTop } from '@/lib/hooks/use-mega-menu-top';
import { cn } from '@/lib/utils';

interface Props {
  solid: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function HeaderMegaMenu({ solid, onOpenChange }: Props) {
  const t = useTranslations();
  const pathname = usePathname();
  const [openId, setOpenId] = useState<string | null>(null);
  const [renderId, setRenderId] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isOpen = openId !== null;
  const top = useMegaMenuTop(isOpen, navRef);

  const activeGroup = headerMegaGroups.find((g) => g.id === renderId) ?? null;

  const clearTimers = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const scheduleClose = () => {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpenId(null), 140);
  };

  useEffect(() => {
    // монтирование панели: каскад намеренный — уход панели должен быть виден, а не резким размонтажем
    if (openId) {
      clearTimers();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRenderId(openId);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else if (renderId) {
      setVisible(false);
      hideTimer.current = setTimeout(() => setRenderId(null), 220);
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [openId, renderId]);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    // смена маршрута — закрыть (панель не должна жить после навигации)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenId(null);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    const onDown = (e: MouseEvent) => {
      if (
        !navRef.current?.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      )
        setOpenId(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label={t('a11y.mainNav')}
      className={cn(
        'hidden items-center gap-1 lg:flex',
        'rounded-full border p-1',
        solid
          ? 'border-border-default bg-surface-card/70 backdrop-blur-xl'
          : 'border-white/10 bg-white/5 backdrop-blur-xl',
      )}
    >
      {headerMegaGroups.map((group) => {
        const active =
          isActiveNavPath(pathname, group.href) ||
          group.children.some((c) => isActiveNavPath(pathname, c.href));
        const open = openId === group.id;
        return (
          <div
            key={group.id}
            className="relative"
            onMouseEnter={() => {
              if (closeTimer.current) {
                clearTimeout(closeTimer.current);
                closeTimer.current = null;
              }
              setOpenId(group.id);
            }}
            onMouseLeave={scheduleClose}
            onFocusCapture={() => {
              if (closeTimer.current) {
                clearTimeout(closeTimer.current);
                closeTimer.current = null;
              }
              setOpenId(group.id);
            }}
            onBlurCapture={(e) => {
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
                if (!open) {
                  e.preventDefault();
                  setOpenId(group.id);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'Enter') {
                  e.preventDefault();
                  setOpenId(group.id);
                }
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-label transition-colors duration-normal ease-brand',
                open
                  ? 'bg-accent text-content-on-accent'
                  : active
                    ? 'bg-accent-soft text-content-accent'
                    : solid
                      ? 'text-content-secondary hover:bg-accent-soft hover:text-content-accent'
                      : 'text-content-on-cinema-muted hover:bg-accent-soft hover:text-content-accent',
              )}
            >
              {t(group.labelKey)}
              <ChevronDownIcon
                className={cn('size-3.5 opacity-60 transition-transform duration-normal', open && 'rotate-180')}
                aria-hidden
              />
            </Link>
          </div>
        );
      })}

      {renderId &&
        activeGroup &&
        top !== null &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{ top: `calc(${top}px + var(--space-2))` }}
            className={cn(
              'fixed left-1/2 z-header w-[min(860px,92vw)] -translate-x-1/2 rounded-2xl border bg-surface-card shadow-xl backdrop-blur-xl',
              'border-border-default p-3 md:p-4',
              'transition-[opacity,translate] duration-200 ease-brand',
              visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0',
            )}
            onMouseEnter={() => {
              if (closeTimer.current) {
                clearTimeout(closeTimer.current);
                closeTimer.current = null;
              }
              setOpenId(renderId);
            }}
            onMouseLeave={scheduleClose}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-eyebrow text-content-tertiary">{t(activeGroup.labelKey)}</p>
              <Link
                href={activeGroup.href}
                onClick={() => setOpenId(null)}
                className="text-caption font-semibold text-content-accent hover:underline"
              >
                {t('common.actions.viewAll' as never)}
              </Link>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {activeGroup.children.map((child) => {
                const Icon = child.icon
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
                      childActive
                        ? 'bg-accent-soft text-content-accent'
                        : 'hover:bg-surface-sunken text-content-primary',
                    )}
                  >
                    {Icon && (
                      <span
                        className={cn(
                          'mt-0.5 grid size-8 place-items-center rounded-lg',
                          childActive
                            ? 'bg-accent text-white'
                            : 'bg-surface-sunken text-content-tertiary group-hover/item:bg-surface-card',
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-body-sm font-semibold leading-none">{t(child.labelKey)}</span>
                      {child.descriptionKey && (
                        <span className="mt-1 block text-caption leading-tight text-content-tertiary">
                          {t(child.descriptionKey)}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </nav>
  );
}

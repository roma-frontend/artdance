'use client';

/**
 * ADMIN SIDEBAR — навигация админки.
 *
 * Клиентский компонент по одной причине: активный пункт определяется текущим
 * путём (`usePathname`), а подсветка «где я нахожусь» в инструменте с двадцатью
 * разделами — не украшение. Всё остальное здесь статично.
 *
 * Пункты приходят уже отфильтрованными по правам: фильтрацию делает сервер, где
 * известен набор capability. Скрытый пункт — не защита (страница проверяет право
 * сама), но показывать поддержке раздел выплат, который ответит отказом, значит
 * врать интерфейсом.
 *
 * На узком экране список превращается в горизонтальную полосу с прокруткой, а не
 * исчезает: админка на телефоне — это «отменить бронь, пока едешь», и потерять
 * навигацию там нельзя.
 */

import { motion, useReducedMotion, type Easing } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef } from 'react';

import { LinkPending } from '@/components/ui/link-pending';
import { routes } from '@/config';
import { motion as designMotion } from '@/design/motion';
import { Link, usePathname } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import type { MessageKey } from '@/i18n/types';
import { cn } from '@/lib/utils';

export interface SidebarItem {
  labelKey: MessageKey;
  href: string;
  badge?: number;
}

export interface SidebarGroup {
  labelKey: MessageKey;
  items: readonly SidebarItem[];
}

interface AdminSidebarProps {
  groups: readonly SidebarGroup[];
  onNavigate?: () => void;
  variant?: 'desktop' | 'drawer';
}

export function AdminSidebar({ groups, onNavigate, variant = 'desktop' }: AdminSidebarProps) {
  const t = useTranslations('admin');
  const tRoot = useTranslations() as unknown as Translate;
  const pathname = usePathname();
  const reduce = useReducedMotion();

  const isDrawer = variant === 'drawer';
  const admin = designMotion.admin;
  const adminEase = admin.ease as unknown as Easing;

  const activeRef = useRef<HTMLLIElement | null>(null);

  const setActiveRef = useCallback((node: HTMLLIElement | null) => {
    activeRef.current = node;
  }, []);

  // активная ссылка всегда в центре видимости — без инверсии
  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';

    const doScroll = () => {
      // scrollIntoView центрирует внутри ближайшего скролл-контейнера
      // (десктоп: [data-admin-sidebar-scroll], drawer: div.overflow-y-auto)
      // — без ручного дельта-расчёта, который давал инверсию
      el.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
    };

    // stagger групп до ~400мс — ждём окончания анимации, иначе координаты съезжают
    const t = window.setTimeout(() => requestAnimationFrame(doScroll), 420);
    const id = requestAnimationFrame(() => requestAnimationFrame(doScroll));
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(id);
    };
  }, [pathname, reduce]);

  return (
    <nav aria-label={t('sectionNav')} className={isDrawer ? '' : 'contents'}>
      {!isDrawer ? <p className="text-eyebrow mb-4 hidden uppercase text-content-tertiary lg:block">{t('title')}</p> : null}

      <motion.div
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={
          reduce
            ? {}
            : {
                hidden: {},
                show: {
                  transition: {
                    staggerChildren: admin.stagger.stepMs / 1000,
                    delayChildren: 0.08,
                  },
                },
              }
        }
        className={isDrawer ? 'flex flex-col gap-6' : 'hidden lg:flex lg:flex-col lg:gap-6'}
      >
        {groups.map((group) => (
          <motion.div
            key={group.labelKey}
            variants={
              reduce
                ? {}
                : {
                    hidden: { opacity: 0, y: 8 },
                    show: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: admin.durationMs.normal / 1000, ease: adminEase },
                    },
                  }
            }
          >
            <p className="text-label mb-2 uppercase tracking-wide text-content-tertiary">{tRoot(group.labelKey)}</p>
            <ul className={isDrawer ? 'flex flex-col gap-1' : 'flex flex-col gap-1'}>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href} ref={active ? setActiveRef : undefined} className="relative">
                    {active ? (
                      <motion.div
                        layoutId={isDrawer ? 'admin-active-drawer' : 'admin-active-desktop'}
                        className="absolute inset-0 rounded-xl bg-accent shadow-sm shadow-accent/20"
                        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 } as unknown as Record<string, unknown>}
                        style={{ willChange: 'transform' }}
                      />
                    ) : null}
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={onNavigate}
                      className={cn(
                        'group relative flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors duration-fast',
                        active
                          ? 'text-content-on-accent font-semibold'
                          : 'text-content-secondary hover:bg-surface-raised hover:text-content-primary active:bg-surface-sunken',
                        isDrawer && 'py-3 text-[15px]',
                      )}
                    >
                      <span className="min-w-0 truncate relative">{tRoot(item.labelKey)}</span>
                      {item.badge !== undefined && item.badge > 0 ? (
                        <span
                          className={cn(
                            'inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums leading-none relative',
                            active ? 'bg-white text-accent' : 'bg-accent-soft text-content-accent border border-accent/10',
                          )}
                        >
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      ) : null}
                      <LinkPending />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ))}
      </motion.div>
    </nav>
  );
}

/**
 * Активный раздел. Сравнение по сегментам, а не `startsWith`: `/admin/classes`
 * не должен подсвечиваться, когда открыт `/admin/classes-archive`, а корень
 * `/admin` — когда открыт любой раздел вообще. Это та же ловушка, из-за которой
 * публичный листинг залов однажды уезжал на страницу входа.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === routes.admin()) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

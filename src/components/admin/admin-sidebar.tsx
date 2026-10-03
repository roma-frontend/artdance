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

import { useTranslations } from 'next-intl';

import { LinkPending } from '@/components/ui/link-pending';
import { routes } from '@/config';
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

  const isDrawer = variant === 'drawer';

  return (
    <nav aria-label={t('sectionNav')} className={isDrawer ? '' : 'contents'}>
      {!isDrawer ? <p className="text-eyebrow mb-4 hidden uppercase text-content-tertiary lg:block">{t('title')}</p> : null}

      <div className={isDrawer ? 'flex flex-col gap-6' : 'hidden lg:flex lg:flex-col lg:gap-6'}>
        {groups.map((group) => (
          <div key={group.labelKey}>
            <p className="text-label mb-2 uppercase tracking-wide text-content-tertiary">{tRoot(group.labelKey)}</p>
            <ul className={isDrawer ? 'flex flex-col gap-1' : 'flex flex-col gap-1'}>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={onNavigate}
                      className={cn(
                        'group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition-all duration-fast',
                        active
                          ? 'bg-accent text-content-on-accent shadow-sm shadow-accent/20 font-semibold'
                          : 'text-content-secondary hover:bg-surface-raised hover:text-content-primary active:bg-surface-sunken',
                        isDrawer && 'py-3 text-[15px]',
                      )}
                    >
                      <span className="min-w-0 truncate">{tRoot(item.labelKey)}</span>
                      {item.badge !== undefined && item.badge > 0 ? (
                        <span
                          className={cn(
                            'inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums leading-none',
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
          </div>
        ))}
      </div>
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

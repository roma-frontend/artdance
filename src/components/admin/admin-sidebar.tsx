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
}

export interface SidebarGroup {
  labelKey: MessageKey;
  items: readonly SidebarItem[];
}

interface AdminSidebarProps {
  groups: readonly SidebarGroup[];
}

export function AdminSidebar({ groups }: AdminSidebarProps) {
  const t = useTranslations('admin');
  /** Узкая подпись: ключи приходят переменными, см. `@/i18n/translate`. */
  const tRoot = useTranslations() as unknown as Translate;
  const pathname = usePathname();

  return (
    <nav aria-label={t('sectionNav')} className="lg:sticky lg:top-6">
      <p className="text-eyebrow mb-4 hidden uppercase text-content-tertiary lg:block">{t('title')}</p>

      <div className="flex gap-6 overflow-x-auto pb-2 lg:flex-col lg:gap-6 lg:overflow-visible lg:pb-0">
        {groups.map((group) => (
          <div key={group.labelKey} className="min-w-max lg:min-w-0">
            <p className="text-label mb-2 uppercase text-content-tertiary">{tRoot(group.labelKey)}</p>

            <ul className="flex gap-1 lg:flex-col">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'text-body-sm block rounded-md px-3 py-2 whitespace-nowrap transition-colors duration-fast',
                        active
                          ? 'bg-accent-soft font-semibold text-content-accent'
                          : 'text-content-secondary hover:bg-interactive-hover hover:text-content-primary',
                      )}
                    >
                      {tRoot(item.labelKey)}
                      {/*
                        Обратная связь на нажатие. В админке она нужнее всего:
                        каждый раздел — динамический маршрут с запросами к базе, и
                        без индикатора между щелчком и новым экраном проходит
                        пауза, в которой человек щёлкает второй раз.
                      */}
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

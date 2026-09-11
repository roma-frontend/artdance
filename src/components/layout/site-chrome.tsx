/**
 * РАМА САЙТА — публичное обрамление страницы: шапка, док, декоративные слои.
 *
 * Зачем отдельный компонент. Шапка объявлена в layout локали, потому что она
 * фиксированная и общая для всех публичных экранов. Админка живёт под тем же
 * layout — и получала публичную шапку поверх своей: `position: fixed` вынимает
 * её из потока, и собственная шапка админки уходила под неё. Убрать родительскую
 * разметку изнутри вложенного layout нельзя, поэтому решение принимается здесь,
 * по адресу.
 *
 * Что остаётся в админке и почему:
 *
 *  • `SkipToContent` — снаружи этого компонента, в layout: ссылка нужна и в
 *    инструменте, а у админской рамы тот же `main` с `site.mainContentId`.
 *  • `ThemeToggle` — остаётся: тёмная тема в инструменте нужна не меньше, а
 *    своего переключателя у админской рамы нет.
 *  • `ScrollProgress` и `PointerGlow` — убираются: это оформление лендинга.
 *    Свечение под курсором вешает слушатель на каждое движение мыши, а полоса
 *    прогресса чтения в таблице заказов означает не то, что показывает.
 *  • `MobileDock` и `SiteHeader` — убираются: у админки своя навигация, и две
 *    несогласованные навигации на экране хуже одной.
 *
 * Признак раздела берётся из `isAdminPath`, а не из `startsWith('/admin')`:
 * адрес объявлен в `src/config/routes.ts` и переименовывается там же.
 */

'use client';

import type { ReactNode } from 'react';

import { PointerGlow } from '@/components/fx/pointer-glow';
import { ScrollProgress } from '@/components/fx/scroll-progress';
import { MobileDock } from '@/components/layout/mobile-dock';
import { SiteHeader } from '@/components/layout/site-header';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { isAdminPath } from '@/config';
import { usePathname } from '@/i18n/routing';

export function SiteChrome({ children }: { children: ReactNode }) {
  /* `usePathname` next-intl отдаёт путь без префикса локали — как ждёт `isAdminPath`. */
  const isAdmin = isAdminPath(usePathname());

  return (
    <>
      {!isAdmin && <ScrollProgress />}
      {!isAdmin && <PointerGlow />}
      {!isAdmin && <SiteHeader />}
      {children}
      {!isAdmin && <MobileDock />}
      <ThemeToggle />
    </>
  );
}

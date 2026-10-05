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

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

import { PortalTransitionProvider } from '@/components/fx/portal-transition';
import { MobileDock } from '@/components/layout/mobile-dock';
import { SiteHeader } from '@/components/layout/site-header';
import { isAdminPath } from '@/config';
import { usePathname } from '@/i18n/routing';
import { useIsLiteMode } from '@/lib/perf/lite-mode';

// Декоративные pointer/scroll эффекты — строго ленивые, не влияют на LCP.
// В лёгком режиме не монтируются вообще: экономия rAF, слушателей и видеопамяти.
const ScrollProgress = dynamic(() => import('@/components/fx/scroll-progress').then((m) => m.ScrollProgress), { ssr: false });
const PointerGlow = dynamic(() => import('@/components/fx/pointer-glow').then((m) => m.PointerGlow), { ssr: false });
const OrbitCursor = dynamic(() => import('@/components/fx/orbit-cursor').then((m) => m.OrbitCursor), { ssr: false });
const Magnetic = dynamic(() => import('@/components/fx/magnetic').then((m) => m.Magnetic), { ssr: false });

const AUTH_PREFIXES = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/verify-email'] as const;

function isAuthPath(pathWithoutLocale: string): boolean {
  return AUTH_PREFIXES.some((p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`));
}

export function SiteChrome({ children }: { children: ReactNode }) {
  /* `usePathname` next-intl отдаёт путь без префикса локали — как ждёт `isAdminPath`. */
  const pathname = usePathname();
  const isAdmin = isAdminPath(pathname);
  const isAuth = isAuthPath(pathname);
  const showPublicChrome = !isAdmin && !isAuth;
  const lite = useIsLiteMode();

  return (
    <PortalTransitionProvider>
      {showPublicChrome && !lite && <ScrollProgress />}
      {showPublicChrome && !lite && <PointerGlow />}
      {showPublicChrome && !lite && <OrbitCursor />}
      {showPublicChrome && !lite && <Magnetic />}
      {showPublicChrome && <SiteHeader />}
      {children}
      {showPublicChrome && <MobileDock />}
    </PortalTransitionProvider>
  );
}

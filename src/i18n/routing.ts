/**
 * Маршрутизация next-intl. Единственный источник локале-зависимой навигации.
 *
 * В компонентах используются `Link`, `redirect`, `useRouter` ИЗ ЭТОГО МОДУЛЯ,
 * а не из `next/link` / `next/navigation` — иначе теряется префикс локали.
 */

import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

import { defaultLocale, locales } from './config';

export const routing = defineRouting({
  locales,
  defaultLocale,
  /** Явный префикс у всех локалей: предсказуемые canonical и кеш на CDN. */
  localePrefix: 'always',
  /** Определять локаль по заголовку `Accept-Language` при первом визите. */
  localeDetection: true,
  localeCookie: {
    name: 'ARTDANCE_LOCALE',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  },
});

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

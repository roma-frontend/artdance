/**
 * Нативные ссылки на приложение (universal links на iOS, App Links на Android).
 *
 * Пути и хост должны совпадать с `mobile/app.json` (associatedDomains, intentFilters).
 * Менять в обоих местах.
 */
export const appLinks = {
  host: 'artdance.am',
  bundleId: 'am.artdance.app',
  /** Префиксы путей, которые открываются в приложении. */
  prefixes: ['/reset-password', '/verify-email'],
} as const;

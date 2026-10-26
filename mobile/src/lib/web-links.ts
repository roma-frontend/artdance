import { Linking } from 'react-native';

import { webUrl } from '@/lib/format';
import type { Locale } from '@/lib/i18n';

/**
 * Публичные лендинги без экрана в приложении. Только они открываются в браузере.
 * Разделы приложения открываются экранами; путь, которого нет ни здесь, ни в экранах, не открывается.
 * Админка и кабинеты на сайте сюда не входят: мобильное приложение их не открывает.
 */
const LANDING_WEB_PATHS: ReadonlySet<string> = new Set([
  '/competitions',
  '/social-events',
  '/athletes',
  '/federations',
  '/partners',
  '/sponsors',
  '/advertise',
  '/corporate',
]);

export function isLandingWebPath(path: string): boolean {
  return LANDING_WEB_PATHS.has(path.split(/[?#]/)[0] ?? '');
}

/** Открывает лендинг в браузере. Возвращает false, если путь не входит в allowlist, и тогда ничего не открывается. */
export function openLandingWebPath(locale: Locale, path: string): boolean {
  if (!isLandingWebPath(path)) return false;
  Linking.openURL(webUrl(locale, path)).catch(() => undefined);
  return true;
}

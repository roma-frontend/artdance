/**
 * Глобальная типизация i18n. Благодаря этому `t('home.hero.badge')`
 * проверяется компилятором, а опечатка в ключе — ошибка сборки.
 */

import type { formats, Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/types';

declare global {
  interface CloudflareEnv {
    HYPERDRIVE: { connectionString: string };
  }
}

declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
    Formats: typeof formats;
  }
}

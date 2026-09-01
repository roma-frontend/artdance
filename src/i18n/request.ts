/**
 * Конфигурация запроса для next-intl (server-side).
 *
 * Здесь же подключаются `formats` — поэтому в компонентах вызывают
 * `format.number(price, 'price')`, а не собирают опции Intl вручную.
 */

import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';

import { defaultLocale, formats } from './config';
import { routing } from './routing';
import { loadMessages } from './messages';
import { isLocal } from '@/config/env';
import { site } from '@/config/site';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
    formats,
    /** Все даты/времена трактуются в часовом поясе бизнеса, а не сервера. */
    timeZone: site.timeZone,
    onError(error) {
      /** Отсутствующий ключ в production не должен ломать страницу. */
      if (isLocal) console.error('[i18n]', error);
    },
    getMessageFallback({ namespace, key }) {
      const path = [namespace, key].filter(Boolean).join('.');
      return isLocal ? `⟨${path}⟩` : '';
    },
  };
});

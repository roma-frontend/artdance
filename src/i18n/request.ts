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
import { getUiOverrides } from '@/server/admin/operator';
import { setMessage } from '@/domain/operator';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : defaultLocale;
  const messages = structuredClone(await loadMessages(locale));
  const overrides = await getUiOverrides(locale);
  for (const row of overrides) {
    if (typeof row.value === 'string') setMessage(messages, row.key.slice(`i18n.${locale}.`.length), row.value);
  }

  return {
    locale,
    messages,
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

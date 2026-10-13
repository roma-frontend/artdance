/**
 * Конфигурация запроса для next-intl (server-side).
 *
 * Здесь же подключаются `formats` — поэтому в компонентах вызывают
 * `format.number(price, 'price')`, а не собирают опции Intl вручную.
 */

import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';

import { defaultLocale, formats, type Locale } from './config';
import { routing } from './routing';
import { loadMessages } from './messages';
import { isLocal } from '@/config/env';
import { site } from '@/config/site';
import { getUiOverrides } from '@/server/admin/operator';
import { setMessage } from '@/domain/operator';

/**
 * Переопределения i18n дороги вдвойне: это БД-запрос (пусть и через
 * `unstable_cache`) плюс `structuredClone` всего дерева сообщений, если строки
 * есть. В подавляющем большинстве запросов переопределений нет, и клонировать
 * объект модуля не нужно — next-intl его читает, а не мутирует.
 *
 * Мемо живёт в процессе и повторяет TTL `getUiOverrides` (300 с): не жёстче
 * того, что уже обещал кеш, но без сериализации значения и обёртки
 * `unstable_cache` на каждом запросе. Срок обязан совпадать с `revalidate: 300`
 * в `src/server/admin/operator.ts` — при правке меняются оба места.
 */
const OVERRIDES_TTL_MS = 300_000;
interface OverridesEntry {
  at: number;
  promise: Promise<Awaited<ReturnType<typeof getUiOverrides>>>;
}
const overridesByLocale = new Map<Locale, OverridesEntry>();

function uiOverrides(locale: Locale) {
  const entry = overridesByLocale.get(locale);
  const now = Date.now();
  if (entry && now - entry.at < OVERRIDES_TTL_MS) return entry.promise;
  const promise = getUiOverrides(locale);
  overridesByLocale.set(locale, { at: now, promise });
  return promise;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : defaultLocale;
  let messages = await loadMessages(locale);
  const overrides = await uiOverrides(locale);
  if (overrides.length > 0) {
    messages = structuredClone(messages);
    for (const row of overrides) {
      if (typeof row.value === 'string') setMessage(messages, row.key.slice(`i18n.${locale}.`.length), row.value);
    }
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

/**
 * ПЕРЕВОД БЕЗ REQUEST-КОНТЕКСТА — для снимков, которые переживают запрос.
 *
 * Нужен там, где строка попадает в базу: `OrderItem.titleSnapshot` читают счёт,
 * письмо и админка — места, где ни локали запроса, ни `NextIntlClientProvider`
 * уже нет. `getTranslations()` из `next-intl/server` для этого не годится: он
 * требует серверного контекста запроса (в тесте падает, в cron отсутствует).
 *
 * Поэтому переводчик собирается из каталога напрямую — `createTranslator`.
 * Плюрализация и подстановки при этом остаются настоящими ICU, а не
 * самодельными: `{count, plural, …}` ведёт себя так же, как в интерфейсе.
 */

import { createTranslator } from 'next-intl';

import type { Locale } from './config';
import en from './messages/en';
import hy from './messages/hy';
import ru from './messages/ru';
import type { MessageKey, Messages } from './types';

/*
 * `Messages` снимает с `en` литеральные типы строк, оставляя форму дерева —
 * ровно так же, как это делает `i18n/types.ts`. Без этого `ru` и `hy` не
 * подходят: их строки — другие литералы, а переводчику нужна форма, а не слова.
 */
const catalogs: Record<Locale, Messages> = { en, ru, hy };

/**
 * Перевод из каталога для снимка. Неизвестный ключ откатывается на сам ключ:
 * пустая строка скрыла бы проблему в счёте, а исключение отменило бы уже
 * оплаченную покупку.
 */
export function translateForSnapshot(
  locale: Locale,
  key: MessageKey,
  values?: Record<string, string | number>,
): string {
  const t = createTranslator({
    locale,
    messages: catalogs[locale],
    onError: () => undefined,
    getMessageFallback: ({ key: fallbackKey }) => fallbackKey,
  });
  return t(key as never, values as never);
}

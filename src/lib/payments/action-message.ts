/**
 * КЛЮЧ ПЕРЕВОДА ИЗ ОШИБКИ SERVER ACTION.
 *
 * `next-safe-action` отдаёт `messageKey` строкой: тип теряется на границе сети,
 * и вставить его в `t(...)` без проверки можно только приведением. Здесь
 * приведение одно на весь проект, и заодно решается содержательный вопрос:
 * ключ, которого нет в каталоге, — это сбой, а не пустая строка на экране.
 *
 * Почему не проверка по каталогу: каталог весит сотни килобайт, а тащить его
 * в клиентский бандл ради одной строки — худший из возможных обменов. Поэтому
 * неизвестный ключ откатывается на общий текст ошибки: человек видит «что-то
 * пошло не так» вместо ничего.
 */

import type { MessageKey } from '@/i18n/types';

/** Ключи, которые действия возвращают наружу. Список закрытый — см. шапку. */
const actionMessageKeys = [
  'common.states.comingSoon',
  'errors.generic.description',
  'errors.generic.title',
  'errors.paymentFailed.description',
  'errors.paymentFailed.title',
  'errors.rateLimited.description',
  'errors.unauthorized.description',
  'errors.forbidden.description',
  'errors.notFound.description',
  'validation.required',
] as const satisfies readonly string[];

type KnownActionKey = (typeof actionMessageKeys)[number];

function isKnownKey(value: string): value is KnownActionKey {
  return (actionMessageKeys as readonly string[]).includes(value);
}

export function toActionMessageKey(value: string | undefined): MessageKey {
  if (value && isKnownKey(value)) return value as MessageKey;
  return 'errors.generic.description' as MessageKey;
}

import 'server-only';

import { getTranslations } from 'next-intl/server';

import type { MessageKey } from './types';

/**
 * КОРНЕВОЙ ПЕРЕВОДЧИК С УЗКОЙ ПОДПИСЬЮ.
 *
 * Зачем это существует. `getTranslations()` без неймспейса типизирован
 * next-intl'овским `NamespacedMessageKeys` — вложенным условным типом по всему
 * дереву каталога. Пока ключей было семьсот, компилятор его разворачивал; с
 * появлением админки их стало больше тысячи семисот, и попытка передать в такой
 * переводчик ЛЮБОЕ значение типа `MessageKey` (а не строковый литерал) даёт
 * `TS2590: Expression produces a union type that is too complex to represent`.
 *
 * Это ровно тот случай, ради которого в проекте есть ключи-данные: подпись
 * колонки, пункт меню и заголовок поля объявлены в конфиге как `MessageKey` —
 * там опечатка и ловится. К моменту вызова ключ уже проверен, и второй раз
 * сверять его с деревом каталога не нужно: нужно только получить строку.
 *
 * Поэтому здесь ровно одно приведение типа на весь проект, с объяснением, вместо
 * `as MessageKey` в тридцати компонентах или отключённой проверки.
 *
 * Правило применения: если ключ — литерал (`t('list.empty')`), берите обычный
 * `getTranslations('admin')` и его типизацию. Этот помощник нужен только там, где
 * ключ приходит переменной.
 */
export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

export async function getRootTranslate(): Promise<Translate> {
  const t = await getTranslations();
  return t as unknown as Translate;
}

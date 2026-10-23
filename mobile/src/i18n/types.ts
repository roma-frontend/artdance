/**
 * Типы каталога сообщений.
 *
 * `en.ts` — эталон структуры. `Messages` снимает с него литеральные типы строк,
 * оставляя форму дерева: любой другой язык обязан иметь ровно те же ключи,
 * иначе TypeScript не соберётся. Это делает «забыл перевести ключ»
 * ошибкой компиляции, а не багом в production.
 */

import type en from './messages/en';

type DeepMessageShape<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepMessageShape<T[K]>;
};

export type Messages = DeepMessageShape<typeof en>;

/** Namespace верхнего уровня — то, что передаётся в `useTranslations('home')`. */
export type MessageNamespace = keyof Messages;

/**
 * Точечный путь до строки: `'home.hero.badge'`.
 * Используется там, где ключ передаётся как данные (конфиг колонок, меню),
 * чтобы вместо текста в объекте лежал типизированный ключ перевода.
 */
export type MessageKey<T = Messages> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`;
    }[keyof T & string];

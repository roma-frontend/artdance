/**
 * ЧТЕНИЕ ДАННЫХ: ОДНА ОБЁРТКА НА ВСЕ ЗАПРОСЫ.
 *
 * `docs/09-helpers-catalog.md` §1 требует этот хелпер первым в задаче 2.1, и
 * причина не в красоте: кеш, который объявляется по месту, расходится с
 * инвалидацией. Тег, указанный при чтении в одном файле, и `revalidateTag` в
 * другом — это два независимых списка строк, и они разъезжаются на первой же
 * правке. Здесь тег объявляется рядом с запросом, поэтому «что кешировалось» и
 * «что сбрасывается» — одно и то же значение.
 *
 * ## Что даёт обёртка
 *
 * **Единственное место, где вызывается примитив кеша.** Сейчас это
 * `unstable_cache`: флаг `cacheComponents` в `next.config.ts` не включён, а
 * директива `'use cache'` без него не работает. Когда флаг включат, меняется этот
 * файл, а не сорок вызовов в страницах — ровно поэтому обёртка появляется до
 * первого запроса, а не после сорокового.
 *
 * **Сроки — из `src/config/cache.ts`.** `revalidate` принимается параметром, но
 * значение обязано приходить из `dataRevalidate`: число по месту означает, что
 * «сделайте каталог свежее» превращается в поиск по проекту.
 *
 * **`revalidate: 0` — это отсутствие кеша, а не нулевой срок.** Доступность
 * слотов кешировать нельзя вовсе: устаревший ответ означает двойную бронь.
 * Обёртка в этом случае вызывает обработчик напрямую, без ключей и тегов.
 *
 * ## Чего обёртка не делает
 *
 * Не проверяет права. Запросы читают публичный каталог; приватное чтение
 * (мой заказ, моя бронь) идёт через гварды в своих модулях и не кешируется —
 * кеш, в котором лежит чужой заказ, страшнее отсутствия кеша.
 *
 * Не принимает время аргументом (см. `stableKey`). Запрос, которому передали
 * `new Date()`, кешируется по новому ключу на каждый вызов: формально это кеш, а
 * фактически — утечка памяти и ноль попаданий.
 */

import 'server-only';

import { unstable_cache } from 'next/cache';

/**
 * Ключ кеша из аргументов запроса.
 *
 * Порядок ключей объекта нормализуется: `{ style, page }` и `{ page, style }` —
 * один и тот же запрос, и два ключа для него означали бы половину попаданий.
 *
 * `Date` и функции отклоняются. Это не перестраховка: `Date` в аргументах
 * означает уникальный ключ на каждый вызов, то есть кеш, который никогда не
 * срабатывает и при этом растёт. Время вычисляется внутри обработчика, а
 * актуальность обеспечивает `revalidate`.
 */
export function stableKey(value: unknown): string {
  if (value instanceof Date) {
    throw new TypeError('defineQuery — время не передаётся аргументом: ключ кеша станет уникальным на каждый вызов');
  }
  if (typeof value === 'function') {
    throw new TypeError('defineQuery — функция не может быть частью ключа кеша');
  }

  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${key}:${stableKey(item)}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value) ?? 'undefined';
}

export interface QueryConfig<TArgs extends unknown[], TResult> {
  /** Имя запроса: часть ключа кеша и метка в трассировке. Уникально в проекте. */
  name: string;
  /**
   * Теги для инвалидации. Только из `cacheTags` — иначе `revalidateTag` промахнётся.
   *
   * `NoInfer` здесь обязателен: без него тип аргументов выводится и из тегов
   * тоже, и `tags: () => [...]` (теги не зависят от аргументов — обычный случай)
   * сузил бы запрос до функции без параметров.
   */
  tags: (...args: NoInfer<TArgs>) => readonly string[];
  /** Срок из `dataRevalidate`. `0` — не кешировать, `false` — до инвалидации по тегу. */
  revalidate: number | false;
  handler: (...args: TArgs) => Promise<TResult>;
}

/**
 * Объявить кешируемый запрос.
 *
 *   export const getClassList = defineQuery({
 *     name: 'classList',
 *     tags: () => [cacheTags.classes()],
 *     revalidate: dataRevalidate.catalog,
 *     handler: async (query: CatalogQuery) => { ... },
 *   });
 *
 * Обёртка создаётся на каждый вызов намеренно: `unstable_cache` фиксирует теги в
 * момент оборачивания, а нам нужны теги, зависящие от аргументов
 * (`cacheTags.class(slug)`). Стоимость — создание замыкания; выгода — точная
 * инвалидация одной сущности вместо сброса всего каталога.
 */
export function defineQuery<TArgs extends unknown[], TResult>(
  config: QueryConfig<TArgs, TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    if (config.revalidate === 0) return config.handler(...args);

    const cached = unstable_cache(() => config.handler(...args), [config.name, stableKey(args)], {
      tags: [...config.tags(...args)],
      revalidate: config.revalidate,
    });

    return cached();
  };
}

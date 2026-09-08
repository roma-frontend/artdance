/**
 * JSON-LD в разметке страницы.
 *
 * Почему компонент, а не `<script>` руками на каждой странице: строку нужно
 * экранировать. `JSON.stringify` оставляет `<` как есть, и описание с текстом
 * вида `<script>` закрывает наш тег и превращает данные в исполняемый код.
 * `\u003c` — стандартная защита, и она обязана быть в одном месте, а не в памяти
 * того, кто добавляет следующую схему.
 *
 * `dangerouslySetInnerHTML` здесь — единственный способ: React экранирует текст
 * внутри `<script>` под HTML-правилам, и JSON-LD ломается на кавычках.
 *
 * Инлайн-скрипт разрешён политикой безопасности (`script-src 'unsafe-inline'` в
 * `config/security.ts`); тип `application/ld+json` браузером не исполняется.
 */

import type { JsonLd } from '@/lib/seo/jsonld';

interface JsonLdScriptProps {
  /** Одна схема или несколько — они выводятся одним массивом `@graph`. */
  schema: JsonLd | readonly JsonLd[];
}

export function JsonLdScript({ schema }: JsonLdScriptProps) {
  const payload = Array.isArray(schema)
    ? { '@context': 'https://schema.org', '@graph': schema }
    : schema;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(payload).replace(/</g, '\\u003c'),
      }}
    />
  );
}

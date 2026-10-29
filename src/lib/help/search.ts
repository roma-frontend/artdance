/**
 * Поиск по справочному центру.
 *
 * Ищет по тем же данным, что и страница: темам справки и вопросам FAQ. Отдельного
 * индекса нет, поэтому результат всегда совпадает с тем, что видно на странице.
 *
 * Правила простые и предсказуемые: запрос делится на слова, и каждое слово должно
 * встретиться в заголовке или тексте записи как подстрока. Все слова обязаны
 * совпасть, но могут стоять в разных полях записи. Регистр, `ё`/`е` и
 * полноширинные символы не различаются. Морфологии и опечаток нет: для справки из
 * нескольких десятков записей этого достаточно.
 */

/** Короче двух символов поиск совпадает почти со всем справочником, поэтому не ищет вовсе. */
export const MIN_HELP_QUERY_LENGTH = 2;

export interface SearchableTopic {
  title: string;
  body: string;
}

export interface SearchableFaq {
  question: string;
  answer: string;
}

export interface HelpSearchResult<T extends SearchableTopic, F extends SearchableFaq> {
  topics: T[];
  faq: F[];
}

/** NFKC (полноширинные буквы в обычные), нижний регистр, `ё` → `е`, пробелы в один. */
export function normalizeHelpQuery(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Возвращает найденные объекты как есть, без копий: страница берёт из них
 * заголовки, тексты и ссылки.
 */
export function searchHelp<T extends SearchableTopic, F extends SearchableFaq>(
  query: string,
  topics: readonly T[],
  faq: readonly F[],
): HelpSearchResult<T, F> {
  const normalized = normalizeHelpQuery(query);
  if (normalized.length < MIN_HELP_QUERY_LENGTH) return { topics: [], faq: [] };

  const terms = normalized.split(' ');
  const matches = (fields: readonly string[]): boolean => {
    const haystack = normalizeHelpQuery(fields.join(' '));
    return terms.every((term) => haystack.includes(term));
  };

  return {
    topics: topics.filter((topic) => matches([topic.title, topic.body])),
    faq: faq.filter((entry) => matches([entry.question, entry.answer])),
  };
}

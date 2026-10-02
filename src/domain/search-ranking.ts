import { matchesQuery } from '@/domain/catalog';
import { danceStylesMatchingTerm, type DanceStyle } from '@/domain/enums';
import type { SearchHit } from '@/domain/search';

/**
 * Строка каталога до ранжирования.
 *
 * `fields` содержит текст, который участвует в поиске, но не показывается как
 * заголовок. `styles` обслуживает смысловой поиск по направлению: запрос
 * «сальса» находит занятие «Latin Fusion», даже если слова «сальса» в названии
 * нет.
 */
export interface SearchCandidate extends SearchHit {
  fields: readonly (string | null | undefined)[];
  styles?: readonly DanceStyle[];
}

/**
 * Ранжирует уже отобранные публичные записи каталога.
 *
 * Меньше ранг — выше результат: название → связанное поле → направление.
 * Индекс сохраняет исходный порядок при равном ранге, поэтому одинаковый
 * запрос не перемешивает выдачу между обращениями.
 */
export function rankSearchCandidates(
  candidates: readonly SearchCandidate[],
  term: string,
  limit: number,
): readonly SearchHit[] {
  const matchedStyles = danceStylesMatchingTerm(term);

  return candidates
    .map((candidate, index) => {
      const fields = candidate.fields.filter(
        (field): field is string => typeof field === 'string',
      );
      const byStyle =
        candidate.styles?.some((style) => matchedStyles.includes(style)) ?? false;
      const rank = matchesQuery(term, [candidate.title])
        ? 0
        : matchesQuery(term, fields)
          ? 1
          : byStyle
            ? 2
            : null;

      return { candidate, index, rank };
    })
    .filter(
      (entry): entry is typeof entry & { rank: number } => entry.rank !== null,
    )
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .slice(0, Math.max(0, limit))
    .map(({ candidate }) => ({
      id: candidate.id,
      scope: candidate.scope,
      title: candidate.title,
      subtitle: candidate.subtitle,
      href: candidate.href,
      image: candidate.image,
      ...(candidate.price !== undefined ? { price: candidate.price } : {}),
    }));
}

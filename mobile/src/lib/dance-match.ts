import type { DancerLevel, DancerProfile } from './dancer-profile';

/** Что человек готов показать о себе в ссылке: без имени, контактов и идентификаторов. */
export type MatchCard = {
  level: DancerLevel;
  styles: string[];
  goal: string | null;
};

const LEVELS: readonly DancerLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const MAX_STYLES = 10;
const MAX_TEXT = 40;
export const MATCH_SCHEME_PATH = 'dance-match';

export function toMatchCard(profile: DancerProfile): MatchCard {
  return { level: profile.level, styles: profile.styles.slice(0, MAX_STYLES), goal: profile.goal };
}

/** Ссылка вида artdance://dance-match?p=... Работает и в мессенджере, и внутри приложения. */
export function buildMatchUrl(card: MatchCard): string {
  return `artdance://${MATCH_SCHEME_PATH}?p=${encodeURIComponent(JSON.stringify(card))}`;
}

/** Разбирает входящий параметр и отбрасывает всё, что не похоже на карту танцора. */
export function parseMatchCard(raw: string | undefined): MatchCard | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const candidate = data as Record<string, unknown>;
  if (!LEVELS.includes(candidate.level as DancerLevel)) return null;
  if (!Array.isArray(candidate.styles)) return null;
  const styles = candidate.styles
    .filter((style): style is string => typeof style === 'string')
    .map((style) => style.slice(0, MAX_TEXT))
    .slice(0, MAX_STYLES);
  const goal = typeof candidate.goal === 'string' ? candidate.goal.slice(0, MAX_TEXT) : null;
  return { level: candidate.level as DancerLevel, styles, goal };
}

export type MatchResult = {
  score: number;
  sharedStyles: string[];
  levelGap: number;
};

/**
 * Совместимость 0–100: уровень (до 40), общие направления по Жаккару (до 40), цель (до 20).
 * Чужой уровень на две ступени и больше даёт ноль: вести в паре с таким партнёром неудобно.
 */
export function scoreMatch(mine: MatchCard, theirs: MatchCard): MatchResult {
  const levelGap = Math.abs(LEVELS.indexOf(mine.level) - LEVELS.indexOf(theirs.level));
  const levelScore = levelGap === 0 ? 40 : levelGap === 1 ? 25 : 0;

  const mineStyles = new Set(mine.styles);
  const sharedStyles = theirs.styles.filter((style) => mineStyles.has(style));
  const unionSize = new Set([...mine.styles, ...theirs.styles]).size;
  const styleScore = unionSize === 0 ? 0 : Math.round((40 * sharedStyles.length) / unionSize);

  const goalA = mine.goal?.trim().toLowerCase() ?? '';
  const goalB = theirs.goal?.trim().toLowerCase() ?? '';
  const goalScore = goalA === '' && goalB === '' ? 10 : goalA !== '' && goalA === goalB ? 20 : 5;

  return {
    score: Math.min(100, levelScore + styleScore + goalScore),
    sharedStyles,
    levelGap,
  };
}

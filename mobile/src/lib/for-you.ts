import type { ClassCard } from './catalog';
import type { DancerProfile } from './dancer-profile';

const LEVEL_RANK: Record<string, number> = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2, PROFESSIONAL: 3 };

/**
 * Оценка занятия для анкеты. Чем выше, тем ближе к человеку:
 * совпадение направления важнее уровня, а свободные места и тренд только подталкивают.
 */
export function scoreForYou(card: ClassCard, profile: DancerProfile): number {
  let score = 0;
  if (profile.styles.includes(card.style)) score += 3;
  const cardRank = LEVEL_RANK[card.level];
  const profileRank = LEVEL_RANK[profile.level];
  if (cardRank !== undefined && profileRank !== undefined) {
    const gap = Math.abs(cardRank - profileRank);
    if (gap === 0) score += 2;
    else if (gap === 1) score += 1;
  }
  if (card.spotsLeft > 0) score += 1;
  if (card.isTrending) score += 1;
  return score;
}

/** Ранжирует занятия по анкете: без повторов, только с ненулевой оценкой, лучшие первыми. */
export function rankForYou(cards: ClassCard[], profile: DancerProfile, limit = 8): ClassCard[] {
  const seen = new Set<string>();
  const scored: { card: ClassCard; score: number }[] = [];
  for (const card of cards) {
    if (seen.has(card.slug)) continue;
    seen.add(card.slug);
    const score = scoreForYou(card, profile);
    if (score > 0) scored.push({ card, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((item) => item.card);
}

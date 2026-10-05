import type { DanceStyle } from '@/domain/enums';

/** Editorial suggestions, not a promise of suitability or live availability. */
export const danceIntents = ['energy', 'flow', 'partner', 'stage'] as const;
export type DanceIntent = (typeof danceIntents)[number];

export const danceIntentStyles: Record<DanceIntent, readonly DanceStyle[]> = {
  energy: ['HIP_HOP', 'BREAKING', 'KPOP', 'AFRO', 'JAZZ'],
  flow: ['CONTEMPORARY', 'BALLET', 'STRETCHING', 'HEELS'],
  partner: ['SALSA', 'BACHATA', 'TANGO', 'KIZOMBA', 'WEDDING_DANCE'],
  stage: ['BALLROOM', 'LATIN', 'ARMENIAN_FOLK', 'FLAMENCO'],
};

export function suggestedDanceStyles(intent: DanceIntent, available: readonly string[]): DanceStyle[] {
  const styles = new Set(available);
  return danceIntentStyles[intent].filter((style) => styles.has(style));
}

/** Only supported filters leave the picker; no invented time-of-day query. */
export const danceFinderLevels = ['BEGINNER', 'INTERMEDIATE', 'ALL_LEVELS'] as const;
export const firstLessonTopics = ['partner', 'wear', 'experience'] as const;

export type DanceMood = 'pulse' | 'flow' | 'embrace' | 'stage';
export function danceMood(style: string): DanceMood {
  if (danceIntentStyles.energy.includes(style as DanceStyle)) return 'pulse';
  if (danceIntentStyles.flow.includes(style as DanceStyle)) return 'flow';
  if (danceIntentStyles.partner.includes(style as DanceStyle)) return 'embrace';
  return 'stage';
}

/** Unknown/missing language data must remain absent, not become an assumed language. */
export const instructorLanguageKeys = {
  hy: 'home.teacher.languages.hy',
  ru: 'home.teacher.languages.ru',
  en: 'home.teacher.languages.en',
} as const;

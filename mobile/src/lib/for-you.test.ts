import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rankForYou, scoreForYou } from './for-you.ts';

type Card = { slug: string; style: string; level: string; spotsLeft: number; isTrending: boolean };

const profile = { level: 'BEGINNER', styles: ['SALSA'], onboardingCompleted: true } as unknown as Parameters<typeof scoreForYou>[1];

const card = (overrides: Partial<Card>): Card => ({
  slug: 'c',
  style: 'HIP_HOP',
  level: 'ADVANCED',
  spotsLeft: 0,
  isTrending: false,
  ...overrides,
});

test('a matching style outweighs a level match alone', () => {
  const styleOnly = scoreForYou(card({ style: 'SALSA', level: 'ADVANCED' }) as never, profile);
  const levelOnly = scoreForYou(card({ style: 'HIP_HOP', level: 'BEGINNER' }) as never, profile);
  assert.ok(styleOnly > levelOnly);
});

test('unrelated classes with no free spots and no trend score zero and are dropped', () => {
  const ranked = rankForYou([card({ slug: 'far' })] as never, profile);
  assert.equal(ranked.length, 0);
});

test('duplicates by slug are removed and the best scores come first', () => {
  const list = [
    card({ slug: 'a', style: 'SALSA', level: 'BEGINNER' }),
    card({ slug: 'a', style: 'SALSA', level: 'BEGINNER' }),
    card({ slug: 'b', style: 'SALSA', level: 'ADVANCED' }),
    card({ slug: 'c', style: 'HIP_HOP', level: 'BEGINNER', isTrending: true }),
  ] as never;
  const ranked = rankForYou(list, profile) as unknown as Card[];
  assert.deepEqual(ranked.map((item) => item.slug), ['a', 'b', 'c']);
});

test('the result is capped by limit', () => {
  const list = Array.from({ length: 20 }, (_, i) => card({ slug: `s${i}`, style: 'SALSA' })) as never;
  assert.equal(rankForYou(list, profile).length, 8);
});

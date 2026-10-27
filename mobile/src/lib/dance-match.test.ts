import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildMatchUrl, parseMatchCard, scoreMatch, toMatchCard, type MatchCard } from './dance-match.ts';

const base: MatchCard = { level: 'INTERMEDIATE', styles: ['SALSA', 'BACHATA'], goal: 'social' };

test('identical profiles score the maximum', () => {
  const result = scoreMatch(base, { ...base });
  assert.equal(result.score, 100);
  assert.deepEqual(result.sharedStyles, ['SALSA', 'BACHATA']);
  assert.equal(result.levelGap, 0);
});

test('a two-level gap gives no level points', () => {
  const far = scoreMatch({ ...base, level: 'BEGINNER' }, { ...base, level: 'ADVANCED' });
  const near = scoreMatch({ ...base, level: 'BEGINNER' }, { ...base, level: 'INTERMEDIATE' });
  assert.ok(far.score < near.score);
  assert.equal(far.levelGap, 2);
});

test('no shared styles and no goals still returns a bounded score', () => {
  const result = scoreMatch({ level: 'BEGINNER', styles: ['SALSA'], goal: null }, { level: 'BEGINNER', styles: ['HIP_HOP'], goal: null });
  assert.equal(result.sharedStyles.length, 0);
  assert.ok(result.score >= 0 && result.score <= 100);
});

test('empty style lists do not divide by zero', () => {
  const result = scoreMatch({ level: 'BEGINNER', styles: [], goal: null }, { level: 'BEGINNER', styles: [], goal: null });
  assert.ok(Number.isFinite(result.score));
});

test('parse round-trips a url built from a profile card', () => {
  const url = buildMatchUrl(base);
  const raw = new URL(url).searchParams.get('p') ?? undefined;
  assert.deepEqual(parseMatchCard(raw), base);
});

test('parse rejects malformed or unknown payloads', () => {
  assert.equal(parseMatchCard(undefined), null);
  assert.equal(parseMatchCard('not json'), null);
  assert.equal(parseMatchCard(JSON.stringify({ level: 'GOD', styles: [], goal: null })), null);
  assert.equal(parseMatchCard(JSON.stringify({ level: 'BEGINNER', styles: 'SALSA', goal: null })), null);
});

test('parse caps styles and text length', () => {
  const long = 'x'.repeat(200);
  const many = Array.from({ length: 30 }, () => long);
  const parsed = parseMatchCard(JSON.stringify({ level: 'BEGINNER', styles: many, goal: long }));
  assert.ok(parsed);
  assert.equal(parsed.styles.length, 10);
  assert.equal(parsed.styles[0].length, 40);
  assert.equal(parsed.goal?.length, 40);
});

test('toMatchCard drops everything except level, styles and goal', () => {
  const card = toMatchCard({
    level: 'ADVANCED',
    styles: ['SALSA'],
    goal: 'fitness',
    onboardingCompleted: true,
    name: 'Anna',
    phone: '+374',
  } as unknown as Parameters<typeof toMatchCard>[0]);
  assert.deepEqual(Object.keys(card).sort(), ['goal', 'level', 'styles']);
});

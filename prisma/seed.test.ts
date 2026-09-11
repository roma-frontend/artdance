/**
 * Охранный тест сида: `upsert` по частичному уникальному ключу.
 *
 * Корзина объявила уникальность слагов, SKU и кодов частичной —
 * `@@unique([slug], where: raw("\"deletedAt\" IS NULL"))`. Postgres не принимает
 * частичный индекс как цель `ON CONFLICT` без такого же предиката, а Prisma
 * предикат не генерирует: `prisma.venue.upsert({ where: { slug } })` падает с
 * `42P10` на любом Postgres.
 *
 * Ошибка тихая в худшем смысле — она не видна ни типами, ни линтером, ни
 * тестами, потому что проявляется только при запуске сида на живой базе, а `npm
 * run verify` базы не имеет. Один раз она уже стоила разбора на пустом месте:
 * миграция корзины прошла, а `npm run db:seed` перестал работать, и заметили это
 * при заливке демо-данных на хостинг.
 *
 * Поэтому проверка статическая: сопоставляем частичные уникальные ключи из схемы
 * с вызовами `upsert` в сиде. Замена — `upsertLive` в самом сиде.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (name: string): string =>
  readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');

const schema = read('./schema.prisma');
const seed = read('./seed.ts');

/** Модели, у которых хотя бы одна уникальность объявлена с предикатом. */
function modelsWithPartialUnique(): string[] {
  const found: string[] = [];
  let current: string | null = null;

  for (const line of schema.split('\n')) {
    const model = /^model\s+(\w+)\s*\{/.exec(line);
    if (model) {
      current = model[1] ?? null;
      continue;
    }
    if (current && line.includes('@@unique') && line.includes('where: raw')) {
      found.push(current);
    }
  }

  return [...new Set(found)];
}

/** Модели, по которым сид вызывает `upsert` (`prisma.danceClass.upsert(`). */
function modelsUpsertedBySeed(): string[] {
  const found = [...seed.matchAll(/prisma\.(\w+)\.upsert\(/g)].map((match) => match[1] ?? '');
  return [...new Set(found)];
}

/** `danceClass` → `DanceClass`: имя делегата в имя модели. */
function delegateToModel(delegate: string): string {
  return delegate.charAt(0).toUpperCase() + delegate.slice(1);
}

describe('сид и частичные уникальные индексы', () => {
  it('в схеме есть частичные уникальные индексы — иначе проверка бессмысленна', () => {
    expect(modelsWithPartialUnique().length).toBeGreaterThan(0);
  });

  it('сид не вызывает upsert ни по одной модели с частичной уникальностью', () => {
    const partial = new Set(modelsWithPartialUnique());
    const offenders = modelsUpsertedBySeed()
      .map(delegateToModel)
      .filter((model) => partial.has(model));

    expect(
      offenders,
      `prisma.<модель>.upsert для ${offenders.join(', ')} упадёт с 42P10: ` +
        'уникальность объявлена с предикатом deletedAt IS NULL. Используйте upsertLive.',
    ).toEqual([]);
  });

  it('замена объявлена и используется', () => {
    expect(seed).toContain('async function upsertLive(');
    expect(seed.match(/await upsertLive\(/g)?.length ?? 0).toBeGreaterThan(5);
  });

  it('upsertLive ищет только живые записи', () => {
    const body = seed.slice(seed.indexOf('async function upsertLive('));
    expect(body.slice(0, body.indexOf('return row.id'))).toContain('deletedAt: null');
  });
});

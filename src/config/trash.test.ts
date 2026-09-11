/**
 * Список моделей корзины против схемы Prisma.
 *
 * `trashedModels` — обычный массив строк, и компилятор не знает, есть ли у модели
 * колонка `deletedAt`. Расхождение видно только в рантайме, и по-разному:
 * забытая колонка даёт ошибку Prisma на каждом запросе к модели, а забытая модель
 * в списке — тихую утечку удалённой записи в публичный каталог.
 *
 * Вторая проверка — про уникальные ограничения. Если `slug` остался уникальным
 * ЦЕЛИКОМ, удалённая запись продолжает занимать свой адрес, и создать новую с тем
 * же слагом нельзя: администратор видит «адрес занят», не видя, кем.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { modelDelegateKey, trashedModels } from './trash';

const source = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');

interface ModelBlock {
  fields: string[];
  attributes: string[];
}

function parseModels(text: string): Map<string, ModelBlock> {
  const models = new Map<string, ModelBlock>();
  let current: ModelBlock | null = null;

  for (const raw of text.split('\n')) {
    const line = raw.trim();

    const opening = /^model\s+(\w+)\s*\{$/.exec(line);
    if (opening) {
      const [, name] = opening;
      current = { fields: [], attributes: [] };
      if (name) models.set(name, current);
      continue;
    }

    if (line === '}') {
      current = null;
      continue;
    }

    if (!current || line.startsWith('//')) continue;

    if (line.startsWith('@@')) current.attributes.push(line);
    else current.fields.push(line);
  }

  return models;
}

const models = parseModels(source);

/**
 * Уникальные ограничения, которые остаются полными осознанно.
 *
 * `MediaAsset.storageKey` — ключ файла в хранилище. Две записи на один объект
 * означают, что окончательное удаление одной уносит файл у другой, и
 * восстановленная запись покажет битую картинку. Файл принадлежит записи один к
 * одному, и ограничение так и говорит.
 */
const fullUniqueExceptions: ReadonlyArray<`${string}.${string}`> = ['MediaAsset.storageKey'];

describe('модели корзины', () => {
  it('схема прочитана', () => {
    expect(models.size).toBeGreaterThan(50);
  });

  it('каждая объявленная модель есть в схеме', () => {
    const missing = trashedModels.filter((model) => !models.has(model));
    expect(missing).toEqual([]);
  });

  it('у каждой есть колонка deletedAt', () => {
    const without = trashedModels.filter(
      (model) => !(models.get(model)?.fields ?? []).some((field) => /^deletedAt\s/.test(field)),
    );

    expect(without).toEqual([]);
  });

  it('у каждой есть индекс по deletedAt — по нему работает чистка', () => {
    const without = trashedModels.filter(
      (model) => !(models.get(model)?.attributes ?? []).includes('@@index([deletedAt])'),
    );

    expect(without).toEqual([]);
  });

  it('уникальные ограничения частичные', () => {
    const full: string[] = [];

    for (const model of trashedModels) {
      const block = models.get(model);
      if (!block) continue;

      for (const field of block.fields) {
        const unique = /^(\w+)\s+.*@unique/.exec(field);
        if (!unique) continue;

        const name = `${model}.${unique[1] ?? ''}` as `${string}.${string}`;
        if (!fullUniqueExceptions.includes(name)) full.push(`${name} — поле объявлено @unique целиком`);
      }

      for (const attribute of block.attributes) {
        if (!attribute.startsWith('@@unique(')) continue;
        if (!attribute.includes('where:')) full.push(`${model}: ${attribute}`);
      }
    }

    expect(full).toEqual([]);
  });

  it('исключения из частичности действительно существуют в схеме', () => {
    /* Иначе список исключений тихо переживёт переименование колонки. */
    for (const exception of fullUniqueExceptions) {
      const [model, field] = exception.split('.');
      const fields = models.get(model ?? '')?.fields ?? [];

      expect(
        fields.some((line) => new RegExp(`^${field}\\s`).test(line) && line.includes('@unique')),
        exception,
      ).toBe(true);
    }
  });
});

describe('имя делегата', () => {
  it('первая буква становится строчной', () => {
    expect(modelDelegateKey('DanceClass')).toBe('danceClass');
    expect(modelDelegateKey('MediaAsset')).toBe('mediaAsset');
  });
});

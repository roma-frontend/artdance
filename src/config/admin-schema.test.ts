/**
 * Описание ресурсов админки против схемы Prisma.
 *
 * Смысл проверки: `src/config/admin.ts` объявляет, какие поля показывать и
 * записывать, но записывает их реестр напрямую в Prisma. Расхождение между этим
 * описанием и схемой не видит ни компилятор (имена полей — строки), ни линтер —
 * его видит только пользователь, у которого форма не сохраняется.
 *
 * Именно так и нашлась ошибка с `perUserLimit`: необязательное поле формы,
 * NOT NULL колонка в схеме, `null` в `data` — и Prisma отвергала создание
 * промокода целиком.
 *
 * Схема читается текстом: DMMF в клиенте Prisma 7 не поставляется, а разбор
 * тридцати строк дешевле зависимости.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { orderedAdminResources } from './admin.ts';

interface SchemaField {
  name: string;
  type: string;
  optional: boolean;
  list: boolean;
  hasDefault: boolean;
  hasRelation: boolean;
}

type SchemaModels = Map<string, Map<string, SchemaField>>;

function parseSchema(source: string): SchemaModels {
  const models: SchemaModels = new Map();
  let current: Map<string, SchemaField> | null = null;

  for (const raw of source.split('\n')) {
    const line = raw.trim();

    if (line.startsWith('//') || line.length === 0) continue;

    const opening = /^model\s+(\w+)\s*\{$/.exec(line);
    if (opening) {
      const [, modelName] = opening;
      current = new Map();
      if (modelName) models.set(modelName, current);
      continue;
    }

    if (line === '}') {
      current = null;
      continue;
    }

    if (!current || line.startsWith('@@')) continue;

    const parsed = /^(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/.exec(line);
    if (!parsed) continue;

    const [, name, type, list, optional, rest = ''] = parsed;
    if (!name || !type) continue;

    current.set(name, {
      name,
      type,
      list: list === '[]',
      optional: optional === '?',
      hasDefault: rest.includes('@default('),
      hasRelation: rest.includes('@relation('),
    });
  }

  return models;
}

const models = parseSchema(readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8'));

/** Поле формы `published` — это флаг над `publishedAt`, а не колонка. */
const publishedFlag = 'published';

describe('разбор схемы', () => {
  it('модели прочитаны', () => {
    expect(models.size).toBeGreaterThan(50);
  });

  it('необязательная колонка распознаётся', () => {
    expect(models.get('DanceClass')?.get('venueId')?.optional).toBe(true);
  });

  it('колонка со значением по умолчанию распознаётся', () => {
    expect(models.get('PromoCode')?.get('perUserLimit')?.hasDefault).toBe(true);
    expect(models.get('PromoCode')?.get('perUserLimit')?.optional).toBe(false);
  });
});

describe('ресурсы админки соответствуют схеме', () => {
  it('модель каждого ресурса есть в схеме', () => {
    for (const spec of orderedAdminResources) {
      expect(models.has(spec.model), `${spec.id} → model ${spec.model}`).toBe(true);
    }
  });

  it('каждое поле формы есть в модели', () => {
    const missing: string[] = [];

    for (const spec of orderedAdminResources) {
      const model = models.get(spec.model);
      if (!model) continue;

      for (const field of spec.fields) {
        const column = field.name === publishedFlag ? 'publishedAt' : field.name;
        if (!model.has(column)) missing.push(`${spec.id}.${field.name} → ${spec.model}.${column}`);
      }
    }

    expect(missing).toEqual([]);
  });

  /*
   * Главная проверка. Необязательное поле формы уходит в Prisma как `null` —
   * значит, колонка обязана допускать NULL. Если не допускает, поле должно быть
   * помечено `dbDefault`, и реестр уберёт ключ вместо записи NULL.
   */
  it('необязательное поле пишется в обнуляемую колонку либо помечено dbDefault', () => {
    const unmarked: string[] = [];

    for (const spec of orderedAdminResources) {
      const model = models.get(spec.model);
      if (!model) continue;

      for (const field of spec.fields) {
        if (field.required === true || field.name === publishedFlag) continue;
        if (field.kind === 'switch' || field.kind === 'list' || field.kind === 'multiselect') continue;

        const column = model.get(field.name);
        if (!column || column.optional || column.list) continue;
        if (field.dbDefault === true) continue;

        unmarked.push(`${spec.id}.${field.name} (${spec.model}.${field.name} NOT NULL)`);
      }
    }

    expect(unmarked).toEqual([]);
  });

  it('признак dbDefault не стоит там, где колонка обнуляемая', () => {
    const extra: string[] = [];

    for (const spec of orderedAdminResources) {
      const model = models.get(spec.model);
      if (!model) continue;

      for (const field of spec.fields) {
        if (field.dbDefault !== true) continue;

        const column = model.get(field.name);
        if (!column) continue;
        if (column.optional) extra.push(`${spec.id}.${field.name} — колонка допускает NULL`);
        if (!column.hasDefault) extra.push(`${spec.id}.${field.name} — у колонки нет @default`);
        if (field.required === true) extra.push(`${spec.id}.${field.name} — поле и так обязательное`);
      }
    }

    expect(extra).toEqual([]);
  });

  it('поле-список пишется в колонку-список', () => {
    const mismatched: string[] = [];

    for (const spec of orderedAdminResources) {
      const model = models.get(spec.model);
      if (!model) continue;

      for (const field of spec.fields) {
        if (field.kind !== 'list' && field.kind !== 'multiselect') continue;

        const column = model.get(field.name);
        if (column && !column.list) mismatched.push(`${spec.id}.${field.name}`);
      }
    }

    expect(mismatched).toEqual([]);
  });

  it('поле-связь пишется в колонку внешнего ключа', () => {
    const wrong: string[] = [];

    for (const spec of orderedAdminResources) {
      const model = models.get(spec.model);
      if (!model) continue;

      for (const field of spec.fields) {
        if (field.kind !== 'relation') continue;

        const column = model.get(field.name);
        if (column && column.type !== 'String') wrong.push(`${spec.id}.${field.name} → ${column.type}`);
      }
    }

    expect(wrong).toEqual([]);
  });
});

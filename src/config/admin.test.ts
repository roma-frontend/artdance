/**
 * Целостность описания админки.
 *
 * Тест существует потому, что админка построена на данных: одна форма и один
 * список читают `adminResourceSpecs`, и ошибка в описании не ломает сборку — она
 * тихо даёт пустой селект, колонку без значений или форму, которую невозможно
 * сохранить. Компилятор проверяет типы, но не смысл: `primaryField: 'titel'`
 * компилируется.
 *
 * Проверяется именно то, на что опираются страницы и реестр.
 */

import { describe, expect, it } from 'vitest';

import { adminResourceSpecs, orderedAdminResources } from './admin';
import { capabilities } from './capabilities';
import { adminResources } from './routes';

describe('описание ресурсов админки', () => {
  it('покрывает каждый сегмент маршрута', () => {
    for (const resource of adminResources) {
      expect(adminResourceSpecs[resource]).toBeDefined();
      expect(adminResourceSpecs[resource].id).toBe(resource);
    }

    expect(orderedAdminResources).toHaveLength(adminResources.length);
  });

  it('использует только объявленные права', () => {
    const known = new Set<string>(capabilities);

    for (const spec of orderedAdminResources) {
      expect(known.has(spec.view), `${spec.id}: view`).toBe(true);
      expect(known.has(spec.edit), `${spec.id}: edit`).toBe(true);
      if (spec.publish) expect(known.has(spec.publish), `${spec.id}: publish`).toBe(true);
      if (spec.remove) expect(known.has(spec.remove), `${spec.id}: remove`).toBe(true);
    }
  });

  it('не повторяет имена полей внутри ресурса', () => {
    for (const spec of orderedAdminResources) {
      const names = spec.fields.map((field) => field.name);
      expect(new Set(names).size, `${spec.id}`).toBe(names.length);
    }
  });

  it('не повторяет ключи колонок внутри ресурса', () => {
    for (const spec of orderedAdminResources) {
      const keys = spec.columns.map((column) => column.key);
      expect(new Set(keys).size, `${spec.id}`).toBe(keys.length);
    }
  });

  it('показывает поле-заголовок в списке: иначе запись нельзя открыть', () => {
    for (const spec of orderedAdminResources) {
      const keys = spec.columns.map((column) => column.key);
      expect(keys, `${spec.id}`).toContain(spec.primaryField);
    }
  });

  it('у полей-связей указан источник вариантов', () => {
    for (const spec of orderedAdminResources) {
      for (const field of spec.fields) {
        if (field.kind !== 'relation') continue;
        expect(field.relation, `${spec.id}.${field.name}`).toBeDefined();
      }
    }
  });

  it('у select и multiselect есть варианты', () => {
    for (const spec of orderedAdminResources) {
      for (const field of spec.fields) {
        if (field.kind !== 'select' && field.kind !== 'multiselect') continue;
        expect((field.options ?? []).length, `${spec.id}.${field.name}`).toBeGreaterThan(0);
      }
    }
  });

  it('вложенный ресурс ссылается на существующего родителя и хранит его в своём поле', () => {
    for (const spec of orderedAdminResources) {
      if (!spec.parent) continue;

      expect(adminResourceSpecs[spec.parent.resource], `${spec.id}`).toBeDefined();

      const names = spec.fields.map((field) => field.name);
      expect(names, `${spec.id}: поле родителя`).toContain(spec.parent.field);
    }
  });

  /**
   * Фильтр статуса и массовые действия построены на этом соответствии: раздел с
   * `statusFilter: 'active'` обязан иметь поле `isActive`, иначе фильтр молча
   * ничего не отбирает, а массовое «включить» падает на записи.
   */
  it('фильтр статуса соответствует полю записи', () => {
    for (const spec of orderedAdminResources) {
      const names = spec.fields.map((field) => field.name);

      if (spec.statusFilter === 'active') {
        expect(names, `${spec.id}`).toContain('isActive');
      }
      if (spec.statusFilter === 'published') {
        expect(names, `${spec.id}`).toContain('isPublished');
      }
      if (spec.statusFilter === 'moderation') {
        expect(names, `${spec.id}`).toContain('moderation');
      }
    }
  });

  it('ключи переводов начинаются с неймспейса admin', () => {
    for (const spec of orderedAdminResources) {
      expect(spec.titleKey.startsWith('admin.')).toBe(true);
      expect(spec.subtitleKey.startsWith('admin.')).toBe(true);
      expect(spec.navLabelKey.startsWith('admin.')).toBe(true);

      for (const field of spec.fields) {
        expect(field.labelKey.startsWith('admin.'), `${spec.id}.${field.name}`).toBe(true);
      }
    }
  });
});

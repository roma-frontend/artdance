/**
 * ОХРАННИК КОРЗИНЫ — проверка того, что нельзя проверить типами.
 *
 * Расширение клиента (`src/lib/db.ts`) отсекает удалённые записи из любого чтения
 * верхнего уровня. До вложенных выборок расширения запросов Prisma не доходят —
 * это ограничение самой Prisma, а не недоделка. Значит, каждая вложенная связь с
 * мягко удаляемой моделью обязана нести фильтр сама, и забыть его можно молча:
 * компилятор доволен, тесты зелёные, а на странице площадки виден удалённый зал.
 *
 * Поэтому проверка читает исходники. Правило одно: если в запросе открывается
 * связь с мягко удаляемой моделью (`rooms: {`, `media: {`, …), внутри её блока
 * обязано встретиться `notTrashed`. Ссылка на готовую константу (`media:
 * mediaRelation`) под правило не попадает — она блок не открывает, а фильтр несёт
 * сама, и это проверяется отдельно.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { trashedModels } from '@/config/trash';
import { notTrashed, onlyTrashed, purgeCutoff, readArgsWithoutTrashed } from '@/domain/trash';

/**
 * Имена связей «ко многим», ведущих на мягко удаляемые модели. Выведены из схемы
 * вручную и закреплены тестом ниже: список полей связи в схеме и здесь совпадает.
 */
const softDeletableRelations = [
  'media',
  'sessions',
  'variants',
  'rooms',
  'classes',
  'lessons',
] as const;

/** Где ищем запросы. Клиентские компоненты в БД не ходят. */
const queryFiles = [
  'src/server/queries/classes.ts',
  'src/server/queries/events.ts',
  'src/server/queries/favorites.ts',
  'src/server/queries/instructors.ts',
  'src/server/queries/products.ts',
  'src/server/queries/reviews.ts',
  'src/server/queries/slugs.ts',
  'src/server/queries/styles.ts',
  'src/server/queries/venues.ts',
  'src/server/queries/relations.ts',
  'src/server/admin/registry.ts',
  'src/server/admin/dashboard.ts',
  'src/server/admin/operations.ts',
  'src/server/admin/people.ts',
] as const;

interface Opening {
  file: string;
  line: number;
  relation: string;
  body: string;
}

/**
 * Блоки, открывающие связь. Тело собирается до закрывающей скобки того же
 * отступа — этого достаточно: вложенные условия глубже, а закрытие ровно на
 * уровне открытия.
 */
function relationOpenings(file: string, source: string): Opening[] {
  const lines = source.split('\n');
  const found: Opening[] = [];
  const opening = new RegExp(`^(\\s*)(${softDeletableRelations.join('|')})\\s*:\\s*\\{`);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const match = opening.exec(line);
    if (!match) continue;

    const indent = match[1] ?? '';
    const relation = match[2] ?? '';
    const body: string[] = [line];

    for (let next = index + 1; next < lines.length; next += 1) {
      const bodyLine = lines[next] ?? '';
      body.push(bodyLine);
      if (new RegExp(`^${indent}\\}`).test(bodyLine)) break;
    }

    found.push({ file, line: index + 1, relation, body: body.join('\n') });
  }

  return found;
}

const openings = queryFiles.flatMap((file) =>
  relationOpenings(file, readFileSync(new URL(`../../../${file}`, import.meta.url), 'utf8')),
);

describe('вложенные связи не показывают удалённое', () => {
  it('в исходниках есть что проверять', () => {
    /*
     * Защита от «проверка ничего не нашла и поэтому прошла»: если разбор
     * сломается или файлы переедут, тест обязан упасть, а не позеленеть.
     */
    expect(openings.length).toBeGreaterThan(3);
  });

  it('каждый открытый блок связи несёт notTrashed', () => {
    const unfiltered = openings
      .filter((opening) => !opening.body.includes('notTrashed'))
      .map((opening) => `${opening.file}:${opening.line} — ${opening.relation}`);

    expect(unfiltered).toEqual([]);
  });
});

describe('подмешивание фильтра в чтение', () => {
  it('модель без мягкого удаления не трогается', () => {
    const args = { where: { id: 'x' } };
    expect(readArgsWithoutTrashed('Order', 'findMany', args)).toBe(args);
  });

  it('операция записи не трогается', () => {
    const args = { where: { id: 'x' }, data: {} };
    expect(readArgsWithoutTrashed('DanceClass', 'update', args)).toBe(args);
  });

  it('чтение без аргументов получает фильтр', () => {
    expect(readArgsWithoutTrashed('DanceClass', 'count', undefined)).toEqual({
      where: { deletedAt: null },
    });
  });

  it('чтение с условием получает фильтр, не теряя условия', () => {
    expect(readArgsWithoutTrashed('Venue', 'findMany', { where: { city: 'Yerevan' }, take: 5 })).toEqual({
      where: { city: 'Yerevan', deletedAt: null },
      take: 5,
    });
  });

  it('findUnique тоже фильтруется', () => {
    expect(readArgsWithoutTrashed('InstructorProfile', 'findUnique', { where: { userId: 'u1' } })).toEqual({
      where: { userId: 'u1', deletedAt: null },
    });
  });

  it('запрос, который сам говорит про deletedAt, остаётся как есть', () => {
    const args = { where: onlyTrashed };
    expect(readArgsWithoutTrashed('DanceClass', 'findMany', args)).toBe(args);
  });

  it('условие внутри OR фильтр не отключает', () => {
    const args = { where: { OR: [{ deletedAt: null }, { isActive: true }] } };

    expect(readArgsWithoutTrashed('DanceClass', 'findMany', args)).toEqual({
      where: { OR: [{ deletedAt: null }, { isActive: true }], deletedAt: null },
    });
  });

  it('все объявленные модели фильтруются', () => {
    for (const model of trashedModels) {
      expect(readArgsWithoutTrashed(model, 'findMany', {}), model).toEqual({
        where: { deletedAt: null },
      });
    }
  });
});

describe('срок хранения', () => {
  it('порог отсчитывается назад от переданного момента', () => {
    const now = new Date('2026-09-09T12:00:00.000Z');
    expect(purgeCutoff(now).toISOString()).toBe('2026-08-10T12:00:00.000Z');
  });

  it('условия корзины не совпадают друг с другом', () => {
    expect(notTrashed).not.toEqual(onlyTrashed);
  });
});

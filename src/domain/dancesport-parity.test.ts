/**
 * DS-01: паритет доменных констант таксономии и её миграции.
 *
 * `src/domain/dancesport.ts` задаёт состав «какие стили и к какой дисциплине»,
 * миграция `20261031120000_dance_discipline_taxonomy` задаёт то же самое в базе.
 * Тест держит их в строю: изменили константы — тест назовёт файл миграции,
 * который нужно править новой миграцией, а не правкой старой.
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { type DanceStyle } from './enums';
import { disciplines, socialCoreStyles, socialOtherStyles } from './dancesport';

function linkSet(list: readonly { style: DanceStyle }[], value: string) {
  return list.map(({ style }) => `('${style}', '${value}')`);
}

const MIGRATION_DIR = path.resolve(__dirname, '../../prisma/migrations/20261031120000_dance_discipline_taxonomy');

describe('DS-01: миграция таксономии совпадает с доменом', () => {
  it('миграция существует в репозитории', () => {
    expect(fs.existsSync(path.join(MIGRATION_DIR, 'migration.sql'))).toBe(true);
  });

  it('связи в миграции ровно — «спортивные стили → DANCESPORT» и «социальные стили → SOCIAL»', () => {
    const sql = fs.readFileSync(path.join(MIGRATION_DIR, 'migration.sql'), 'utf8');
    /*
     * Каждая вставка в миграцию должна совпадать со связью, которую дают
     * доменные константы: спортивный стиль не должен пропасть из DANCESPORT,
     * социальный — из SOCIAL, и лишних связей быть не должно.
     */
    const expectedDanceSport = linkSet(disciplines, 'discipline_dancesport');
    const expectedSocial = linkSet([...socialCoreStyles, ...socialOtherStyles].map((style) => ({ style })), 'discipline_social');
    for (const value of [...expectedDanceSport, ...expectedSocial]) {
      expect(sql, `нет связи ${value}`).toContain(value);
    }
    /* Лишние вставки с чужими идентификаторами дисциплин не появляются. */
    expect(sql.match(/'discipline_(?!dancesport|social)\w*'/g)).toBeNull();
    /* Обратная проверка: стили только из Social не должны войти в DANCESPORT. */
    const sport = new Set(disciplines.map(({ style }) => style));
    for (const style of [...socialCoreStyles, ...socialOtherStyles]) {
      if (!sport.has(style)) {
        expect(sql, `${style} не должен входить в DANCESPORT`).not.toContain(`('${style}', 'discipline_dancesport')`);
      }
    }
  });

  it('танго спортивное и социальное — одна запись в каждом наборе миграции', () => {
    const sql = fs.readFileSync(path.join(MIGRATION_DIR, 'migration.sql'), 'utf8');
    expect(sql).toContain("('TANGO', 'discipline_dancesport')");
    expect(sql).toContain("('TANGO', 'discipline_social')");
  });
});

/**
 * У КАЖДОГО ключа тарифа есть место, где его реально спрашивают.
 *
 * Проверка перебором исходников, а не по списку в тесте: список пришлось бы
 * поддерживать руками и он охотно отражал бы желаемое, а не действительное.
 * Именно так однажды вышло: панель показывала двенадцать тумблеров, и пять из
 * них не меняли ничего, потому что ни одна страница ключ не читала.
 *
 * Что считается точкой защиты: файл, который импортирует сервис или гвард
 * тумблеров и упоминает ключ. Описание ключа (каталог, env-карта, переводы)
 * защитой не считается — иначе тест подтвердил бы наличие строки в строке.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { entitlementFeatureCatalog } from './catalog';

const SRC = join(process.cwd(), 'src');

/** Статический или ленивый импорт слоя тумблеров. */
const TUMBLER_IMPORT = /from ['"]@\/server\/entitlements\/(service|guard)['"]|import\(\s*['"]@\/server\/entitlements\/service['"]\s*\)/;

/** Каталог и гвард сами по себе ничего не защищают — это описание и механизм. */
const MECHANISM_DIR = join('server', 'entitlements') + sep;
/** Env-карта и пресеты — тоже описание: тумблер в них объявлен, а не спрошен. */
const DESCRIPTION_DIR = join('config') + sep;
/**
 * SEO-слой (карта сайта, метаданные) только наследует решение раздела: он прячет
 * адрес, когда модуль выключен, но сам модуль не включает и не открывает.
 * Считать его точкой защиты значило бы подтвердить тестом, что URL убран из
 * `sitemap.xml`, в то время как страница за ним отдаёт 404 или не существует.
 */
const SEO_DIR = join('lib', 'seo') + sep;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const guardFiles = walk(SRC)
  .filter((file) => !/\.test\.tsx?$/.test(file))
  .map((file) => ({ path: relative(SRC, file), text: readFileSync(file, 'utf8') }))
  .filter(({ path }) => !path.startsWith(MECHANISM_DIR))
  .filter(({ path }) => !path.startsWith(DESCRIPTION_DIR))
  .filter(({ path }) => !path.startsWith(SEO_DIR))
  .filter(({ text }) => TUMBLER_IMPORT.test(text));

/**
 * Мобильное приложение — второй потребитель тумблеров: экраны читают их через
 * `useEntitlements()` (ответ того же сервиса). Такой экран тоже точка защиты,
 * иначе ключи, которые живут только в приложении, выглядели бы мёртвыми.
 */
const MOBILE_ROOT = join(process.cwd(), 'mobile');
const mobileGuardFiles = ['app', 'src']
  .flatMap((dir) => {
    const abs = join(MOBILE_ROOT, dir);
    try {
      return walk(abs);
    } catch {
      return [];
    }
  })
  .filter((file) => !/\.test\.tsx?$/.test(file))
  .map((file) => ({ path: relative(process.cwd(), file), text: readFileSync(file, 'utf8') }))
  .filter(({ text }) => /\buseEntitlements\s*\(/.test(text));

describe('точки защиты тумблеров', () => {
  it('найдены файлы, где тумблер вообще спрашивают', () => {
    expect(guardFiles.length, 'ни один файл не читает сервис тумблеров').toBeGreaterThan(0);
  });

  for (const meta of entitlementFeatureCatalog) {
    it(`ключ «${meta.key}» читают хотя бы в одном месте`, () => {
      const webHits = guardFiles
        .filter(({ text }) => new RegExp(`\\b${meta.key}\\b`).test(text))
        .map(({ path }) => path);
      const mobileHits = mobileGuardFiles
        .filter(({ text }) => new RegExp(`\\b${meta.key}\\b`).test(text))
        .map(({ path }) => path);
      const hits = [...webHits, ...mobileHits];

      expect(
        hits,
        `ключ «${meta.key}» (тариф ${meta.tier}) есть в панели, но ни одна страница его не читает — ` +
          'тумблер выглядит рабочим и ничего не включает',
      ).not.toEqual([]);
    });
  }
});

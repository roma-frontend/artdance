/**
 * Статус переноса дизайна в код.
 *
 *   npm run design:status
 *
 * Отвечает на два вопроса, на которые иначе отвечают «по ощущениям»:
 *   1. какие компоненты из карты уже существуют, а какие нет — по волнам;
 *   2. какие CSS-классы прототипа не закреплены ни за одним компонентом, то есть
 *      какая часть макета может потеряться при вёрстке.
 *
 * Скрипт ничего не создаёт и не падает: это отчёт для планирования. Падать он
 * начинает только с флагом `--strict`, когда есть непокрытые классы — это
 * имеет смысл включить в CI на финальной стадии вёрстки.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildWaves,
  componentManifest,
  coveredPrototypeClasses,
} from '../src/design/component-manifest.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const REFERENCE = join(ROOT, 'design', 'reference', 'artdance-final.html');

const strict = process.argv.includes('--strict');

/* ── 1. Готовность компонентов ── */
const done: string[] = [];
const todo: string[] = [];

for (const spec of componentManifest) {
  const full = join(ROOT, 'src', spec.path);
  (existsSync(full) ? done : todo).push(spec.name);
}

console.log(`design:status — реализовано ${done.length} из ${componentManifest.length} компонентов\n`);

for (const wave of buildWaves) {
  const specs = componentManifest.filter((spec) => spec.wave === wave);
  const ready = specs.filter((spec) => done.includes(spec.name));
  const bar = `${'#'.repeat(ready.length)}${'.'.repeat(specs.length - ready.length)}`;
  console.log(`  ${wave.padEnd(11)} ${String(ready.length).padStart(2)}/${String(specs.length).padEnd(2)} ${bar}`);
  for (const spec of specs) {
    const mark = done.includes(spec.name) ? 'x' : ' ';
    console.log(`      [${mark}] ${spec.name.padEnd(24)} ${spec.path}`);
  }
}

/* ── 2. Покрытие классов прототипа ── */
if (!existsSync(REFERENCE)) {
  console.log('\nЭталон прототипа не найден. Выполните: npm run design:import');
  process.exit(0);
}

const html = readFileSync(REFERENCE, 'utf8');
const usedClasses = new Set<string>();
for (const match of html.matchAll(/class="([^"]+)"/g)) {
  for (const className of match[1]!.split(/\s+/)) {
    if (className) usedClasses.add(className);
  }
}

/**
 * Утилитарные и служебные классы прототипа, которые не становятся компонентами.
 *
 * Это классы-однострочники: отступ, направление флекса, размер шрифта, чередование
 * фона секций. В продукте им соответствуют токен-утилиты Tailwind, а не файлы, и
 * держать их в карте компонентов означало бы обещать компонент на каждый `mt-md`.
 */
const IGNORED = new Set([
  'container',
  'section',
  'page',
  'active',
  'grid3',
  'grid4',
  'g',
  'c',
  'accent',
  'accent-accent',
  'ok',
  'low',
  'divider',
  'flex-1',
  'flex-row',
  'inner-container',
  'mb-lg',
  'mt-lg',
  'mt-md',
  'section-bg-alt',
  'text-body',
  'text-body-semibold',
  'text-body-semibold-sm',
  'text-bold',
  'text-bold-lg',
  'text-display',
  'text-muted',
  'text-semibold-lg',
  'text-sm',
]);

const covered = coveredPrototypeClasses();
const uncovered = [...usedClasses].filter((c) => !covered.has(c) && !IGNORED.has(c)).sort();

console.log(
  `\nКлассы прототипа: всего ${usedClasses.size}, ` +
    `закреплено за компонентами ${covered.size}, служебных ${IGNORED.size}`,
);

if (uncovered.length > 0) {
  console.log(`\nНе закреплены ни за одним компонентом (${uncovered.length}):`);
  console.log(`  ${uncovered.join(' ')}`);
  console.log(
    '  Это части макета, которые могут потеряться при вёрстке. Либо добавьте их в\n' +
      '  prototypeClasses соответствующего компонента, либо в IGNORED этого скрипта.',
  );
  if (strict) process.exit(1);
} else {
  console.log('\nВсе значимые классы прототипа закреплены за компонентами.');
}

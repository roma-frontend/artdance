/**
 * Проверка, что каждая используемая CSS-переменная существует.
 *
 *   npm run css:check
 *
 * Зачем отдельная проверка. `var(--layout-section-y-wide)` при опечатке в имени
 * не даёт ни ошибки сборки, ни предупреждения в консоли, ни падения теста: CSS
 * просто игнорирует объявление. Найденный случай — у editorial-секции не было
 * вертикальных отступов, потому что генератор писал `--layout-section-ywide`, а
 * компонент обращался к `--layout-section-y-wide`. Заметно это стало только
 * глазами и только на макете рядом.
 *
 * Что делает скрипт:
 *   1. собирает объявленные переменные из `tokens.css` и `globals.css`;
 *   2. собирает использования `var(--…)` из всех `.ts/.tsx/.css`;
 *   3. падает, если использование не имеет объявления.
 *
 * Переменные, которые объявляет не наш код (Radix, Tailwind, next/font),
 * перечислены в `EXTERNAL_PREFIXES`: они появляются в рантайме, и требовать для
 * них объявления бессмысленно.
 */

import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC = join(ROOT, 'src');

/** Переменные, объявляемые библиотеками и рантаймом, а не нашими токенами. */
const EXTERNAL_PREFIXES = [
  '--radix-',
  '--tw-',
  '--font-', // next/font добавляет свои имена в рантайме
  '--cell-size', // react-day-picker
  '--vaul-',
  '--sonner-',
  '--default-',
  '--spacing', // базовая шкала Tailwind, объявляется самим фреймворком
  '--gap', // выставляется инлайном в toggle-group
  /*
   * Ширина полосы прокрутки, убранной при блокировке скролла. Объявляет
   * react-remove-scroll (через него работают модальные окна Radix и vaul) в
   * рантайме, вместе с атрибутом `data-scroll-locked` на `<body>`. Мы читаем её,
   * чтобы вернуть фиксированной обвязке ширину, на которую выросла область
   * просмотра, — см. правила по `data-scroll-locked` в `globals.css`.
   */
  '--removed-body-scroll-bar-size',
];

const DECLARATION = /(--[a-z0-9-]+)\s*:/g;
const USAGE = /var\(\s*(--[a-z0-9-]+)/g;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'generated') continue;
      walk(full, files);
    } else if (['.ts', '.tsx', '.css'].includes(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(SRC);

const declared = new Set<string>();
for (const file of files) {
  if (extname(file) !== '.css') continue;
  const content = readFileSync(file, 'utf8');
  for (const match of content.matchAll(DECLARATION)) declared.add(match[1]!);
}

interface Usage {
  name: string;
  file: string;
}

const usages: Usage[] = [];
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  for (const match of content.matchAll(USAGE)) {
    usages.push({ name: match[1]!, file: file.replace(ROOT, '').replace(/\\/g, '/') });
  }
}

const missing = usages.filter(
  (usage) =>
    !declared.has(usage.name) && !EXTERNAL_PREFIXES.some((prefix) => usage.name.startsWith(prefix)),
);

if (missing.length > 0) {
  console.error(`css:check — найдено обращений к необъявленным переменным: ${missing.length}\n`);
  const grouped = new Map<string, Set<string>>();
  for (const item of missing) {
    const files = grouped.get(item.name) ?? new Set<string>();
    files.add(item.file);
    grouped.set(item.name, files);
  }
  for (const [name, where] of grouped) {
    console.error(`  • ${name}\n      ${[...where].join('\n      ')}`);
  }
  console.error(
    '\n  Либо опечатка в имени, либо переменную забыли объявить в src/design/tokens.',
  );
  process.exit(1);
}

console.log(
  `css:check — OK (${declared.size} объявлено, ${new Set(usages.map((u) => u.name)).size} использовано)`,
);

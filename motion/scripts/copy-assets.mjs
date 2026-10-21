/**
 * Копирует ассеты проекта в `motion/public/assets` перед рендером.
 *
 * Почему копия не лежит в репозитории: источники — сборка проекта
 * (`.open-next/assets/media`, каталог в .gitignore). Вторая копия тех же 31 МБ
 * разъедется с проектом при первом обновлении медиа.
 *
 * Соответствие задано префиксами, а не точными именами: в сборке к имени
 * добавлен хеш (`hero-loop-1920-ac8e6fb1.mp4`), и он меняется при каждом
 * перекодировании. Разрешение указано в префиксе, поэтому 1280-вариант
 * под шаблон не попадает. Если совпадений не одно — это ошибка, а не повод
 * скопировать что попало: молчаливый выбор не того файла дороже падения.
 */

import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, '..', '.open-next', 'assets', 'media');
const DST = join(root, 'public', 'assets');

/** Префикс пути в сборке → имя в `public/assets`. */
const MAP = [
  ['video/hero-loop-1920-', 'hero-loop.mp4'],
  ['video/editorial-loop-1920-', 'editorial-loop.mp4'],
  ['video/competition-loop-1920-', 'competition-loop.mp4'],
  ['seed/instructor-anna-mkrtchyan.', 'instr-anna.webp'],
  ['seed/instructor-arman-harutyunyan.', 'instr-arman.webp'],
  ['seed/instructor-nare-grigoryan.', 'instr-nare.webp'],
  ['seed/studio-pulse-dance-studio.', 'studio-pulse.webp'],
  ['seed/studio-rhythm-space.', 'studio-rhythm.webp'],
  ['seed/studio-flow-studio.', 'studio-flow.webp'],
  ['seed/product-dance-shoes.', 'prod-shoes.webp'],
  ['seed/product-dance-bag.', 'prod-bag.webp'],
  ['seed/product-gift-card.', 'prod-giftcard.webp'],
  ['style-tiles/ballet/ballet-1920-', 'tiles/ballet.mp4'],
  ['style-tiles/contemporary/contemporary-1920-', 'tiles/contemporary.mp4'],
  ['style-tiles/hiphop/hiphop-1920-', 'tiles/hiphop.mp4'],
  ['style-tiles/salsa/salsa-1920-', 'tiles/salsa.mp4'],
];

/** Файлы сборки, начинающиеся с `prefix` (в одной папке с префиксом). */
async function match(prefix) {
  const dir = join(SRC, dirname(prefix));
  const base = prefix.slice(dirname(prefix) === '.' ? 0 : dirname(prefix).length + 1);
  const entries = await readdir(dir).catch(() => null);
  if (!entries) return null;
  return entries.filter((e) => e.startsWith(base) && !e.endsWith('.webm') && !e.includes('.av1.'));
}

const problems = [];
let copied = 0;

for (const [prefix, name] of MAP) {
  const hits = await match(prefix);
  if (!hits || hits.length !== 1) {
    problems.push(`${prefix} → найдено ${hits ? hits.length : 0} (${hits?.join(', ') ?? 'папки нет'})`);
    continue;
  }
  const to = join(DST, name);
  await mkdir(dirname(to), { recursive: true });
  await copyFile(join(SRC, dirname(prefix), hits[0]), to);
  copied++;
}

console.log(`Скопировано ${copied} из ${MAP.length} в motion/public/assets`);
if (problems.length) {
  console.error(
    `\nНе удалось однозначно сопоставить:\n  ${problems.join('\n  ')}\n\n` +
      'Проверьте, что сборка проекта на месте: npm run build (или npm run design:import).',
  );
  process.exit(1);
}

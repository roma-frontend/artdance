/**
 * Импорт ассетов утверждённого прототипа.
 *
 *   npm run design:import
 *   npm run design:import -- --source "C:\путь\к\artdance-deploy"
 *
 * Что делает:
 *   1. копирует HTML прототипа в `design/reference/artdance-final.html`;
 *   2. копирует изображения в `public/media/seed`, переименовывая по
 *      `design/asset-manifest.ts`;
 *   3. проверяет манифест на расхождения с реальностью: отсутствующие файлы,
 *      неучтённые файлы, изменившийся размер;
 *   4. печатает список того, что требует пережатия перед production.
 *
 * Скрипт идемпотентен: повторный запуск после обновления дизайна перезапишет
 * файлы и снова сверит манифест. Ручное копирование запрещено — иначе через
 * месяц никто не скажет, из какой версии дизайна взята картинка.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { designAssets, designVideos, unusedSourceFiles } from '../design/asset-manifest.ts';
import { videoProcessing } from '../src/config/media-processing.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const DEFAULT_SOURCE = 'C:\\Users\\namel\\Desktop\\artdance-deploy';
const REFERENCE_DIR = join(ROOT, 'design', 'reference');
const SEED_MEDIA_DIR = join(ROOT, 'public', 'media', 'seed');

/** Порог, после которого изображение обязано быть пережато до production. */
const OPTIMIZE_THRESHOLD_BYTES = 500 * 1024;

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const sourceRoot = argValue('--source') ?? process.env.ARTDANCE_DESIGN_SOURCE ?? DEFAULT_SOURCE;
const sourcePhotos = join(sourceRoot, 'photos');
const sourceHtml = join(sourceRoot, 'index.html');

if (!existsSync(sourceRoot)) {
  console.error(
    `design:import — папка прототипа не найдена: ${sourceRoot}\n` +
      'Укажите путь: npm run design:import -- --source "путь\\к\\artdance-deploy"',
  );
  process.exit(1);
}

mkdirSync(REFERENCE_DIR, { recursive: true });
mkdirSync(SEED_MEDIA_DIR, { recursive: true });

const problems: string[] = [];
const needsOptimization: Array<{ name: string; kb: number }> = [];
let copied = 0;

/* ── 1. HTML прототипа ── */
if (existsSync(sourceHtml)) {
  copyFileSync(sourceHtml, join(REFERENCE_DIR, 'artdance-final.html'));
  console.log('design:import — HTML прототипа скопирован в design/reference/');
} else {
  problems.push(`не найден index.html прототипа: ${sourceHtml}`);
}

/* ── 2. Изображения ── */
const accountedSources = new Set<string>();

for (const asset of designAssets) {
  const from = join(sourcePhotos, asset.source);
  accountedSources.add(asset.source);

  if (!existsSync(from)) {
    problems.push(`${asset.name}: исходный файл отсутствует — ${asset.source}`);
    continue;
  }

  const extension = extname(asset.source).toLowerCase();
  const to = join(SEED_MEDIA_DIR, `${asset.name}${extension}`);
  copyFileSync(from, to);
  copied += 1;

  const bytes = statSync(from).size;
  if (bytes > OPTIMIZE_THRESHOLD_BYTES || (extension === '.png' && bytes > 300 * 1024)) {
    needsOptimization.push({ name: `${asset.name}${extension}`, kb: Math.round(bytes / 1024) });
  }
  /** Расхождение манифеста и реальности: помечено как «ок», а файл тяжёлый. */
  if (bytes > OPTIMIZE_THRESHOLD_BYTES && !asset.needsOptimization) {
    problems.push(
      `${asset.name}: ${Math.round(bytes / 1024)} KB, но в манифесте нет needsOptimization`,
    );
  }
}

for (const entry of unusedSourceFiles) accountedSources.add(entry.file);

/* ── 2b. Видео: учитывается, но НЕ копируется в репозиторий ── */
const videoReports: string[] = [];

for (const video of designVideos) {
  accountedSources.add(video.source);
  const from = join(sourcePhotos, video.source);

  if (!existsSync(from)) {
    problems.push(`${video.name}: исходное видео отсутствует — ${video.source}`);
    continue;
  }

  const bytes = statSync(from).size;
  if (bytes !== video.sourceBytes) {
    videoReports.push(
      `${video.source}: размер изменился (${Math.round(video.sourceBytes / 1024)} KB → ` +
        `${Math.round(bytes / 1024)} KB) — обновите sourceBytes в манифесте`,
    );
  }

  const budget = videoProcessing.heroLoop.maxBytes;
  videoReports.push(
    `${video.source}: ${(bytes / (1024 * 1024)).toFixed(1)} MB в макете, ` +
      `бюджет петли ${Math.round(budget / 1024)} KB → нужно кодирование ` +
      `(превышение ×${Math.round(bytes / budget)})`,
  );

  /** Постер обязателен: без него первый кадр — пустой прямоугольник. */
  if (!designAssets.some((asset) => asset.name === video.poster)) {
    problems.push(`${video.name}: постер «${video.poster}» не найден в designAssets`);
  }
}

/* ── 3. Сверка: файлы на диске, которых нет в манифесте ── */
if (existsSync(sourcePhotos)) {
  for (const file of readdirSync(sourcePhotos)) {
    if (!accountedSources.has(file)) {
      problems.push(
        `файл прототипа не учтён в манифесте: ${file} — добавьте в designAssets или в unusedSourceFiles`,
      );
    }
  }
} else {
  problems.push(`не найдена папка photos: ${sourcePhotos}`);
}

/* ── Отчёт ── */
console.log(`design:import — скопировано изображений: ${copied} из ${designAssets.length}`);

if (needsOptimization.length > 0) {
  console.log('\nТребуют пережатия перед production (AVIF/WebP, ≤ 1600px):');
  for (const item of needsOptimization.sort((a, b) => b.kb - a.kb)) {
    console.log(`  ${String(item.kb).padStart(6)} KB  ${item.name}`);
  }
  console.log(
    '  Самый важный — hero: он является LCP-элементом главной страницы, и его вес\n' +
      '  напрямую определяет оценку Core Web Vitals.',
  );
}

if (unusedSourceFiles.length > 0) {
  console.log('\nНеиспользуемые файлы прототипа (переносить не нужно):');
  for (const entry of unusedSourceFiles) {
    console.log(`  ${basename(entry.file)} — ${entry.reason}`);
  }
}

if (videoReports.length > 0) {
  console.log('\nВидео (в репозиторий не копируется — см. designVideos):');
  for (const report of videoReports) console.log(`  • ${report}`);
  console.log(
    '  Команды кодирования — videoEncodeCommands в src/config/media-processing.ts.\n' +
      '  Готовая петля и постер уходят в бакет, а не в git: 21 МБ в истории остаются\n' +
      '  в каждом клоне навсегда.',
  );
}

if (problems.length > 0) {
  console.error(`\ndesign:import — расхождений: ${problems.length}`);
  for (const problem of problems) console.error(`  • ${problem}`);
  process.exit(1);
}

console.log('\ndesign:import — OK, манифест соответствует прототипу');

/**
 * Бюджет веса: JavaScript и статические ассеты.
 *
 *   npm run perf:budget      (после npm run build)
 *
 * Зачем свой скрипт вместо `@next/bundle-analyzer`: анализатор рисует картинку,
 * которую надо смотреть глазами, а бюджет падает в CI. Регресс приходит не одной
 * большой библиотекой, а десятью маленькими за месяц — без автоматического
 * порога это не замечают.
 *
 * Три принципиальных решения:
 *
 * 1. **Считаем gzip, не размер файла.** Пользователь скачивает сжатое; сырой
 *    размер завышен втрое и заставляет ставить бессмысленно большой порог.
 *    Сырой выводится рядом — он определяет время парсинга на слабых телефонах.
 *
 * 2. **Разделяем начальную загрузку и ленивые чанки.** Начальный бандл прямо
 *    влияет на LCP и держится в жёстких рамках. Ленивый чанк (например, SDK
 *    мониторинга, подгружаемый после гидратации) на LCP не влияет, и требовать
 *    от него того же лимита — значит либо отказываться от инструментов, либо
 *    отключать бюджет вовсе. Список начальных чанков берётся из
 *    `build-manifest.json`, а не угадывается.
 *
 * 3. **Изображения считаются вместе с JS.** «Зелёный бюджет бандла» при
 *    мегабайтном hero — самообман: пользователь ждёт картинку, а не скрипт.
 *    Пороги для медиа берутся из `src/config/media-processing.ts`, чтобы не
 *    разойтись с конвейером обработки.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

import {
  mediaProcessing,
  videoLoopKeys,
  videoLoopPolicy,
} from '../src/config/media-processing.ts';

const ROOT = process.cwd();
const NEXT_DIR = join(ROOT, '.next');
const CHUNKS_DIR = join(NEXT_DIR, 'static', 'chunks');
const MANIFEST = join(NEXT_DIR, 'build-manifest.json');
const PUBLIC_DIR = join(ROOT, 'public');

/** Пороги по gzip для JS. Поднимать только осознанно и с объяснением в PR. */
const BUDGET = {
  initialChunk: 90 * 1024,
  initialTotal: 260 * 1024,
  lazyChunk: 250 * 1024,
} as const;

/**
 * Растровые изображения уже сжаты — gzip к ним не применяется, считается размер
 * файла. Порог на файл — самый мягкий из медиа-бюджетов (`fullBleed`): в
 * `public/` лежат и hero-кадры, и иконки, а per-asset контроль по роли делает
 * `npm run media:check`.
 */
const RASTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);
const VECTOR_EXTENSIONS = new Set(['.svg']);
const FONT_EXTENSIONS = new Set(['.woff2', '.woff', '.ttf', '.otf']);
/**
 * Видео считается отдельно и по своему бюджету.
 *
 * Иначе фоновая петля первого экрана вообще не попадала в отчёт: расширения
 * `.mp4`/`.webm` не входили ни в одну группу, и файл мог вырасти с 600 KB до
 * нескольких мегабайт, не потревожив ни одну проверку. При этом сравнивать его с
 * порогом для картинок бессмысленно — у него свой предел в `videoProcessing`.
 *
 * В сумму `public/` видео тоже не идёт: браузер скачивает РОВНО ОДИН источник из
 * трёх, поэтому складывать все форматы и сравнивать с общим порогом означало бы
 * считать трафик, которого не будет.
 */
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm']);

const ASSET_BUDGET = {
  rasterFile: mediaProcessing.budgetBytes.fullBleed,
  publicTotal: mediaProcessing.budgetBytes.seedTotal + 1024 * 1024,
  /** SVG сжимается по пути: считаем gzip. Иконка на 50 KB — это векторная каша. */
  vectorFileGzip: 20 * 1024,
} as const;

/**
 * Бюджет видеофайла — свой у каждой петли.
 *
 * Единого порога здесь быть не может: у петель разные разрешения и разная
 * степень открытости кадра, поэтому и стоимость бита разная. Файл сопоставляется
 * с петлёй по имени; не принадлежащий ни одной петле файл проверяется самым
 * строгим порогом — это либо забытый ассет, либо ошибка в реестре, и молча
 * пропускать его нельзя.
 *
 * Порог — на ОДИН файл, а не на сумму: браузер скачивает ровно один из
 * источников — свою версию по ширине экрана и свой формат по декодируемости.
 * Складывать все двенадцать файлов и сравнивать с общим порогом означало бы
 * считать трафик, которого ни у кого не будет.
 */
function videoBudgetFor(file: string): number {
  const base = basename(file);
  for (const key of videoLoopKeys) {
    if (base.startsWith(videoLoopPolicy[key].baseName)) return videoLoopPolicy[key].maxBytes;
  }
  return Math.min(...videoLoopKeys.map((key) => videoLoopPolicy[key].maxBytes));
}

interface FileEntry {
  name: string;
  base: string;
  raw: number;
  gzip: number;
}

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;

function walk(dir: string, filter: (file: string) => boolean, root = dir): FileEntry[] {
  let dirEntries;
  try {
    dirEntries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: FileEntry[] = [];
  for (const entry of dirEntries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full, filter, root));
      continue;
    }
    if (!filter(entry.name)) continue;
    const raw = statSync(full).size;
    files.push({
      name: full.slice(root.length + 1).replace(/\\/g, '/'),
      base: entry.name,
      raw,
      gzip: gzipSync(readFileSync(full), { level: 9 }).length,
    });
  }
  return files;
}

/** Чанки начальной загрузки. Без манифеста считаем начальными все — fail safe. */
function initialChunkNames(): Set<string> | null {
  if (!existsSync(MANIFEST)) {
    console.warn('perf:budget — build-manifest.json не найден, все чанки считаются начальными');
    return null;
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
    rootMainFiles?: string[];
    polyfillFiles?: string[];
    pages?: Record<string, string[]>;
  };
  const paths = [
    ...(manifest.rootMainFiles ?? []),
    ...(manifest.polyfillFiles ?? []),
    ...Object.values(manifest.pages ?? {}).flat(),
  ];
  return new Set(paths.map((path) => basename(path)));
}

function report(label: string, list: readonly FileEntry[], gzipColumn = true): void {
  if (list.length === 0) return;
  console.log(`\n${label}:`);
  for (const file of list.slice(0, 8)) {
    const size = gzipColumn
      ? `${kb(file.gzip).padStart(10)} gzip  ${kb(file.raw).padStart(10)} raw`
      : `${kb(file.raw).padStart(10)}`;
    console.log(`  ${size}  ${file.name}`);
  }
}

const violations: string[] = [];

/* ─────────────────────────── 1. JavaScript ─────────────────────────── */

if (!existsSync(CHUNKS_DIR)) {
  console.error(`perf:budget — ${CHUNKS_DIR} не найден. Сначала выполните: npm run build`);
  process.exit(1);
}

const initialNames = initialChunkNames();
const chunks = walk(CHUNKS_DIR, (file) => file.endsWith('.js')).sort((a, b) => b.gzip - a.gzip);
const isInitial = (file: FileEntry): boolean => initialNames === null || initialNames.has(file.base);

const initial = chunks.filter(isInitial);
const lazy = chunks.filter((file) => !isInitial(file));

const initialGzip = initial.reduce((sum, file) => sum + file.gzip, 0);
const initialRaw = initial.reduce((sum, file) => sum + file.raw, 0);
const lazyGzip = lazy.reduce((sum, file) => sum + file.gzip, 0);

console.log(
  `perf:budget — начальная загрузка: ${kb(initialGzip)} gzip (${kb(initialRaw)} raw), ` +
    `ленивые чанки: ${kb(lazyGzip)} gzip`,
);
report('Начальная загрузка', initial);
report('Ленивые чанки', lazy);

for (const file of initial) {
  if (file.gzip > BUDGET.initialChunk) {
    violations.push(`начальный чанк ${file.name}: ${kb(file.gzip)} > ${kb(BUDGET.initialChunk)}`);
  }
}
if (initialGzip > BUDGET.initialTotal) {
  violations.push(`начальная загрузка суммарно: ${kb(initialGzip)} > ${kb(BUDGET.initialTotal)}`);
}
for (const file of lazy) {
  if (file.gzip > BUDGET.lazyChunk) {
    violations.push(`ленивый чанк ${file.name}: ${kb(file.gzip)} > ${kb(BUDGET.lazyChunk)}`);
  }
}

/* ────────────────────── 2. Изображения и шрифты ────────────────────── */

const assets = walk(PUBLIC_DIR, (file) => {
  const extension = extname(file).toLowerCase();
  return (
    RASTER_EXTENSIONS.has(extension) || VECTOR_EXTENSIONS.has(extension) || FONT_EXTENSIONS.has(extension)
  );
}).sort((a, b) => b.raw - a.raw);

const raster = assets.filter((file) => RASTER_EXTENSIONS.has(extname(file.name).toLowerCase()));
const vector = assets.filter((file) => VECTOR_EXTENSIONS.has(extname(file.name).toLowerCase()));
const publicTotal = assets.reduce((sum, file) => sum + file.raw, 0);

console.log(
  `\nСтатические ассеты: ${assets.length} файлов, ${kb(publicTotal)} ` +
    `(растр ${raster.length}, вектор ${vector.length})`,
);
report('Самые тяжёлые ассеты', assets, false);

for (const file of raster) {
  if (file.raw > ASSET_BUDGET.rasterFile) {
    violations.push(
      `изображение ${file.name}: ${kb(file.raw)} > ${kb(ASSET_BUDGET.rasterFile)}. ` +
        'Выполните npm run media:optimize',
    );
  }
}
for (const file of vector) {
  if (file.gzip > ASSET_BUDGET.vectorFileGzip) {
    violations.push(`SVG ${file.name}: ${kb(file.gzip)} gzip > ${kb(ASSET_BUDGET.vectorFileGzip)}`);
  }
}
if (publicTotal > ASSET_BUDGET.publicTotal) {
  violations.push(`public/ суммарно: ${kb(publicTotal)} > ${kb(ASSET_BUDGET.publicTotal)}`);
}

/*
 * Видео: каждый источник петли проверяется отдельно своим бюджетом.
 * Браузер скачивает один из них, поэтому важен вес файла, а не их сумма.
 */
const videos = walk(PUBLIC_DIR, (file) => VIDEO_EXTENSIONS.has(extname(file).toLowerCase()));

if (videos.length > 0) {
  const lightest = Math.min(...videos.map((file) => file.raw));
  console.log(
    `\nВидео: ${videoLoopKeys.length} петли, ${videos.length} файлов ` +
      `(версии кадра × форматы), самый лёгкий ${kb(lightest)}. ` +
      `Браузер скачивает ОДИН файл на петлю: свою версию по ширине экрана и свой формат`,
  );
  report('Источники петель', videos, false);

  for (const file of videos) {
    const budget = videoBudgetFor(file.name);
    if (file.raw > budget) {
      violations.push(
        `видео ${file.name}: ${kb(file.raw)} > ${kb(budget)}. ` +
          'Выполните npm run video:encode -- --loop <петля> --input <файл>',
      );
    }
  }
}

/* ──────────────────────────── 3. Итог ──────────────────────────── */

if (violations.length > 0) {
  console.error('\nБюджет превышен:');
  for (const violation of violations) console.error(`  • ${violation}`);
  console.error(
    '\nВарианты: динамический импорт тяжёлой зависимости, ' +
      'добавление пакета в optimizePackageImports, ' +
      'пережатие медиа через npm run media:optimize, ' +
      'либо осознанный подъём порога в этом файле — но не молча.',
  );
  process.exit(1);
}

console.log('\nperf:budget — OK');

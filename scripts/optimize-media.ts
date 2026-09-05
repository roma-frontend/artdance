/**
 * Оптимизация ассетов репозитория.
 *
 *   npm run media:optimize     пережимает и перегенерирует манифест
 *   npm run media:check        только проверяет, ничего не пишет (для CI)
 *
 * Зачем скрипт, а не «один раз пережать вручную»:
 *
 *   • он использует **тот же конвейер**, что и загрузка пользователя
 *     (`src/lib/media/ingest.ts`), поэтому политика сжатия не может разойтись
 *     между демо-контентом и продакшеном;
 *   • он генерирует `design/seed-media.generated.ts` с реальными размерами и
 *     blur-плейсхолдерами — без них `next/image` не может зарезервировать место
 *     под картинку, и вёрстка прыгает при загрузке;
 *   • `--check` в CI не даёт вернуть в репозиторий мегабайтный PNG: бюджет
 *     проверяется автоматически, а не на глаз при ревью.
 *
 * Оригиналы из папки прототипа остаются нетронутыми: скрипт работает только с
 * `public/media/seed`, куда файлы попадают через `npm run design:import`.
 */

import { createHash } from 'node:crypto';
import {
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { designAssets } from '../design/asset-manifest.ts';
import { mediaProcessing, presetBudget } from '../src/config/media-processing.ts';
import { budgetFor, describeImage, processImage, withinBudget } from '../src/lib/media/ingest.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SEED_DIR = join(ROOT, 'public', 'media', 'seed');
const GENERATED = join(ROOT, 'src', 'design', 'seed-media.generated.ts');

const checkOnly = process.argv.includes('--check');

/** Формат мастера для ассетов репозитория: читается всеми браузерами и почтой. */
const SEED_FORMAT = 'webp' as const;

interface SeedEntry {
  name: string;
  file: string;
  width: number;
  height: number;
  bytes: number;
  blurDataUrl: string;
  fingerprint: string;
}

/**
 * Отпечаток содержимого файла — восемь шестнадцатеричных знаков.
 *
 * **Зачем.** Имя файла ассета производно от семантического имени, и при замене
 * содержимого не менялось. Значит, не менялся и URL, а по URL кешируют все:
 * браузер, CDN и — что здесь важнее всего — оптимизатор изображений Next, который
 * держит производные в `.next/cache/images`. Заменённый постер продолжал
 * отдаваться прежним, и это не теория: после подмены постера первого экрана на
 * первый кадр нового клипа страница целую секунду показывала кадр из ПРОШЛОГО
 * макета.
 *
 * Отпечаток стоит в ИМЕНИ файла (`hero-loop-poster.f4fca815.webp`), а не в query:
 * Next 16 отклоняет локальные изображения с query-строкой, если она не описана в
 * `images.localPatterns`, а описать там произвольный отпечаток нечем — сравнение
 * точное. У видео та же болезнь вылечена так же, отпечатком в имени.
 */
function fingerprintOf(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 8);
}

/** Имя оптимизированного файла: `<имя>.<отпечаток>.webp`. */
function seedFileName(name: string, fingerprint: string): string {
  return `${name}.${fingerprint}.${SEED_FORMAT}`;
}

function kb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

/**
 * Все файлы ассета в папке сида: и оптимизированный, и ещё не тронутый исходник.
 *
 * Сравнение по префиксу, а не по равенству: у оптимизированного файла в имени стоит
 * отпечаток содержимого (`hero-loop-poster.f4fca815.webp`), поэтому равенство
 * базового имени его больше не находит.
 */
function filesFor(name: string): string[] {
  return readdirSync(SEED_DIR).filter((file) => {
    const base = file.slice(0, file.length - extname(file).length);
    return base === name || base.startsWith(`${name}.`);
  });
}

function renderGenerated(list: readonly SeedEntry[]): string {
  const rows = [...list]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (entry) => `  '${entry.name}': {
    file: '${entry.file}',
    width: ${entry.width},
    height: ${entry.height},
    bytes: ${entry.bytes},
    fingerprint: '${entry.fingerprint}',
    blurDataUrl:
      '${entry.blurDataUrl}',
  },`,
    )
    .join('\n');

  return `/**
 * СГЕНЕРИРОВАННЫЙ ФАЙЛ. Не редактировать руками.
 *
 * Источник: \`npm run media:optimize\` (scripts/optimize-media.ts).
 * Содержит фактические параметры оптимизированных ассетов из
 * \`public/media/seed\`: имя файла, реальные размеры, вес и blur-плейсхолдер.
 *
 * Нужен потому, что расширение файла меняется при оптимизации, а размеры
 * обязательны для \`next/image\`: без них браузер не может зарезервировать
 * место, и вёрстка прыгает при загрузке.
 */

export interface SeedMediaEntry {
  /** Имя файла в \`public/media/seed\`. */
  file: string;
  width: number;
  height: number;
  bytes: number;
  /**
   * Отпечаток содержимого. Подставляется в URL как \`?v=…\`.
   *
   * Имя файла производно от семантического имени и при замене содержимого не
   * меняется — а по URL кешируют браузер, CDN и оптимизатор изображений Next.
   * Без отпечатка заменённый ассет продолжает отдаваться прежним.
   */
  fingerprint: string;
  /** Инлайновый плейсхолдер, сгенерированный конвейером. */
  blurDataUrl: string;
}

export const seedMedia = {
${rows}
} as const satisfies Record<string, SeedMediaEntry>;

export type SeedMediaName = keyof typeof seedMedia;

/** Суммарный вес папки сид-медиа, байт. Сверяется с \`mediaProcessing.budgetBytes.seedTotal\`. */
export const seedMediaTotalBytes = ${list.reduce((sum, entry) => sum + entry.bytes, 0)};
`;
}

async function main(): Promise<void> {
  const entries: SeedEntry[] = [];
  const problems: string[] = [];
  let sourceTotal = 0;
  let resultTotal = 0;
  let processed = 0;
  let skipped = 0;

  for (const asset of designAssets) {
    const files = filesFor(asset.name);
    if (files.length === 0) {
      problems.push(`${asset.name}: файла нет. Выполните npm run design:import`);
      continue;
    }

    const optimized = files.find((file) => extname(file) === `.${SEED_FORMAT}`);
    const originals = files.filter((file) => extname(file) !== `.${SEED_FORMAT}`);
    const budgetGroup = presetBudget[asset.preset];
    const maxWidth = mediaProcessing.seedMaxWidth[budgetGroup];

    /* ── Уже оптимизирован: описываем файл как есть, без ре-энкода ── */
    if (optimized !== undefined && originals.length === 0) {
      const data = readFileSync(join(SEED_DIR, optimized));
      const described = await describeImage(data);
      const fingerprint = fingerprintOf(data);
      const expected = seedFileName(asset.name, fingerprint);

      /*
       * Имя обязано соответствовать содержимому. Расхождение означает, что файл
       * подменили, не переименовав, — и тогда прежний URL продолжает отдавать
       * прежнюю производную из кеша оптимизатора.
       */
      if (optimized !== expected) {
        if (checkOnly) {
          problems.push(
            `${optimized}: отпечаток в имени не совпадает с содержимым (ожидается ${expected}). ` +
              'Выполните npm run media:optimize',
          );
        } else {
          renameSync(join(SEED_DIR, optimized), join(SEED_DIR, expected));
          console.log(`  ${optimized} → ${expected}`);
        }
      }

      skipped += 1;
      sourceTotal += described.bytes;
      resultTotal += described.bytes;
      entries.push({
        name: asset.name,
        file: expected,
        fingerprint,
        ...described,
      });

      if (!withinBudget(described.bytes, asset.preset)) {
        problems.push(
          `${asset.name}: ${kb(described.bytes)} превышает бюджет ${budgetGroup} (${kb(budgetFor(asset.preset))})`,
        );
      }
      continue;
    }

    /* ── Есть исходник: пережимаем ── */
    const sourceFile = originals[0]!;
    const sourcePath = join(SEED_DIR, sourceFile);
    const sourceBytes = statSync(sourcePath).size;
    sourceTotal += sourceBytes;

    const result = await processImage(readFileSync(sourcePath), {
      preset: asset.preset,
      formats: [SEED_FORMAT],
      masterOnly: true,
      maxDimension: maxWidth,
    });

    if (!result.ok) {
      problems.push(`${sourceFile}: отклонён конвейером (${result.rejection.code})`);
      continue;
    }

    const { master } = result.image;
    const fingerprint = fingerprintOf(master.data);
    const targetFile = seedFileName(asset.name, fingerprint);
    processed += 1;
    resultTotal += master.bytes;

    if (checkOnly) {
      problems.push(
        `${sourceFile}: не оптимизирован (${kb(sourceBytes)} → ${kb(master.bytes)}). Выполните npm run media:optimize`,
      );
    } else {
      writeFileSync(join(SEED_DIR, targetFile), master.data);
      /*
       * Удаляются и исходник, и прежняя оптимизированная версия: в имени стоит
       * отпечаток, поэтому новый файл не перезаписывает старый — они бы накопились
       * в папке и уехали в деплой мёртвым грузом.
       */
      for (const file of files) {
        if (file !== targetFile) unlinkSync(join(SEED_DIR, file));
      }
      const saved = Math.round((1 - master.bytes / sourceBytes) * 100);
      console.log(
        `  ${asset.name.padEnd(30)} ${kb(sourceBytes).padStart(8)} → ${kb(master.bytes).padStart(7)}` +
          `  ${master.width}×${master.height}  −${saved}%`,
      );
    }

    /** Плейсхолдер и размеры — из итоговых байт: тогда `--check` стабилен. */
    entries.push({
      name: asset.name,
      file: targetFile,
      fingerprint,
      ...(await describeImage(master.data)),
    });

    if (!withinBudget(master.bytes, asset.preset)) {
      problems.push(
        `${asset.name}: ${kb(master.bytes)} превышает бюджет ${budgetGroup} (${kb(budgetFor(asset.preset))})`,
      );
    }
  }

  /* Файлы, которых нет в манифесте: мусор, который попадёт в деплой. */
  const knownFiles = new Set(entries.map((entry) => entry.file));
  for (const file of readdirSync(SEED_DIR)) {
    if (!knownFiles.has(file)) {
      problems.push(`${file}: нет в манифесте ассетов — файл лишний или манифест устарел`);
    }
  }

  const generated = renderGenerated(entries);

  if (checkOnly) {
    let current = '';
    try {
      current = readFileSync(GENERATED, 'utf8');
    } catch {
      current = '';
    }
    if (current !== generated) {
      problems.push('src/design/seed-media.generated.ts устарел. Выполните npm run media:optimize');
    }
  } else {
    writeFileSync(GENERATED, generated);
  }

  console.log('');
  if (!checkOnly && processed > 0) {
    const saved = Math.round((1 - resultTotal / sourceTotal) * 100);
    console.log(
      `media:optimize — обработано ${processed}, без изменений ${skipped}. ` +
        `${kb(sourceTotal)} → ${kb(resultTotal)} (−${saved}%)`,
    );
  }

  if (resultTotal > mediaProcessing.budgetBytes.seedTotal) {
    problems.push(
      `суммарный вес сид-медиа ${kb(resultTotal)} превышает бюджет ${kb(mediaProcessing.budgetBytes.seedTotal)}`,
    );
  }

  const label = checkOnly ? 'media:check' : 'media:optimize';

  if (problems.length > 0) {
    console.error(`${label} — проблемы:`);
    for (const problem of problems) console.error(`  • ${problem}`);
    process.exit(1);
  }

  console.log(`${label} — OK (${entries.length} ассетов, ${kb(resultTotal)})`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

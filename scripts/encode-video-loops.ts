/**
 * Кодирование фоновых петель.
 *
 *   npm run video:encode -- --loop editorial --input "C:\путь\к\клипу.mp4"
 *   npm run video:encode -- --loop hero
 *   npm run video:check            — все петли на месте и в своих бюджетах
 *
 * Зачем скрипт, а не команда в README: параметры кодирования обязаны меняться
 * вместе с бюджетом (`videoLoopPolicy` в `src/config/media-processing.ts`), а не
 * отдельно от него. Здесь они только читаются, результат проверяется по весу, а
 * фактические размеры попадают в генерируемый манифест — компонент не выдумывает
 * вес файла, он его знает.
 *
 * Петель две, и обрабатываются они одним кодом: первый экран (`hero`) и
 * заявление бренда (`editorial`). Различия между ними — данные, а не ветки:
 * битрейты, длительность, склейка шва, снятие знака генератора.
 *
 * Требуется `ffmpeg` и `ffprobe` в PATH. Без них скрипт не падает молча, а
 * объясняет, что делать: файлы петель лежат в репозитории, и переэнкод нужен
 * только при смене исходника или бюджета.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  videoLoopKeys,
  videoLoopPolicy,
  type VideoLoopKey,
  type VideoLoopPolicy,
  type VideoRendition,
} from '../src/config/media-processing.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT_DIR = join(ROOT, 'public', 'media', 'video');
const SEED_DIR = join(ROOT, 'public', 'media', 'seed');
const GENERATED = join(ROOT, 'src', 'design', 'video-loops.generated.ts');

type Format = VideoLoopPolicy['formats'][number];

/**
 * Расширение файла для формата. AV1 и H.264 лежат оба в MP4, поэтому у AV1
 * составное расширение — иначе их не различить ни глазом, ни кодом.
 */
const FILE_SUFFIX: Record<Format, string> = {
  av1: '.av1.mp4',
  vp9: '.webm',
  h264: '.mp4',
};

/**
 * Длина отпечатка содержимого в имени файла.
 *
 * **Зачем отпечаток вообще.** Петля отдаётся как статический файл под именем из
 * политики. Пока имя постоянно, замена клипа не меняет URL — и браузер, CDN и
 * кеш сборки продолжают отдавать ПРЕЖНЕЕ видео. Проверить, что клип сменился,
 * тогда нечем, кроме глаз, а два клипа с одной съёмки на глаз неразличимы. Это
 * не теория: на постере ровно так и произошло.
 *
 * Восьми шестнадцатеричных знаков достаточно: файлов петли единицы, а не
 * миллионы, и вероятность совпадения отпечатков практически нулевая.
 */
const FINGERPRINT_LENGTH = 8;

/** Имя файла петли: `hero-loop-1920-3f9a2c1b.webm`. */
function loopFileName(
  baseName: string,
  width: number,
  format: Format,
  fingerprint: string,
): string {
  return `${baseName}-${width}-${fingerprint}${FILE_SUFFIX[format]}`;
}

/** Отпечаток содержимого файла. */
function fingerprintOf(path: string): string {
  return createHash('sha256')
    .update(readFileSync(path))
    .digest('hex')
    .slice(0, FINGERPRINT_LENGTH);
}

interface FileIdentity {
  format: Format;
  width: number;
}

/**
 * Формат и ширина по имени файла — обратная сторона `loopFileName`.
 *
 * Разбор шаблоном, а не сравнением с ожидаемым именем: скрипт проверки
 * (`--check`) читает папку, не имея на руках исходников, и должен понимать, чему
 * принадлежит файл.
 *
 * Имя БЕЗ отпечатка или без ширины здесь намеренно не распознаётся: такой файл
 * остался от прежней схемы, в манифест попадать не должен, и `--check` обязан о
 * нём сообщить, а не молча его учесть. Перевести его на новое имя — `--relink`.
 */
function identify(baseName: string, file: string): FileIdentity | null {
  for (const [format, suffix] of Object.entries(FILE_SUFFIX) as Array<[Format, string]>) {
    const pattern = new RegExp(
      `^${baseName}-(\\d{3,4})-[0-9a-f]{${FINGERPRINT_LENGTH}}${suffix.replace(/\./g, '\\.')}$`,
    );
    const match = pattern.exec(file);
    if (match) return { format, width: Number(match[1]) };
  }
  return null;
}

/**
 * Имена ПРЕЖНИХ схем, которые переводит `--relink`:
 * `hero-loop.webm` (без отпечатка и ширины) и `hero-loop-3f9a2c1b.webm` (без ширины).
 */
function legacyFormatOf(baseName: string, file: string): Format | null {
  for (const [format, suffix] of Object.entries(FILE_SUFFIX) as Array<[Format, string]>) {
    const escaped = suffix.replace(/\./g, '\\.');
    const withoutWidth = new RegExp(
      `^${baseName}(-[0-9a-f]{${FINGERPRINT_LENGTH}})?${escaped}$`,
    );
    if (withoutWidth.test(file)) return format;
  }
  return null;
}

/** Принадлежит ли файл этой петле — в любой из схем имён. */
function belongsToLoop(baseName: string, file: string): boolean {
  return identify(baseName, file) !== null || legacyFormatOf(baseName, file) !== null;
}

/** Постер петли — кадр из неё же, поэтому его имя производно от имени петли. */
function posterAssetName(loop: VideoLoopKey): string {
  return `${videoLoopPolicy[loop].baseName}-poster`;
}

interface Args {
  loop: VideoLoopKey | null;
  input: string | null;
  check: boolean;
  relink: boolean;
}

function args(): Args {
  const argv = process.argv.slice(2);
  const value = (flag: string): string | null => {
    const index = argv.indexOf(flag);
    return index >= 0 ? (argv[index + 1] ?? null) : null;
  };

  const loop = value('--loop');
  if (loop !== null && !videoLoopKeys.includes(loop as VideoLoopKey)) {
    console.error(`video:encode — неизвестная петля «${loop}». Доступны: ${videoLoopKeys.join(', ')}`);
    process.exit(1);
  }

  return {
    loop: (loop as VideoLoopKey | null) ?? null,
    input: value('--input'),
    check: argv.includes('--check'),
    relink: argv.includes('--relink'),
  };
}

function run(command: string, commandArgs: string[]): string {
  return execFileSync(command, commandArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function hasTool(command: string): boolean {
  try {
    run(command, ['-version']);
    return true;
  } catch {
    return false;
  }
}

interface Probe {
  width: number;
  height: number;
  fps: number;
  duration: number;
}

/** Параметры файла: без них нельзя решить, что уменьшать и где резать шов. */
function probe(input: string): Probe {
  const raw = run('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height,r_frame_rate',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=0',
    input,
  ]);

  const value = (key: string): string => {
    const line = raw.split(/\r?\n/).find((row) => row.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1) : '';
  };

  const [num, den] = value('r_frame_rate').split('/').map(Number);

  return {
    width: Number(value('width')),
    height: Number(value('height')),
    fps: den ? (num ?? 0) / den : (num ?? 0),
    duration: Number(value('duration')),
  };
}

/**
 * Цепочка фильтров кадра: снятие знака генератора, масштаб, частота кадров.
 *
 * Порядок обязателен именно такой. `delogo` работает в координатах ИСХОДНОГО
 * кадра — прямоугольник в политике задан для 1280×720, и если сначала уменьшить
 * кадр, заплатка уедет в сторону от знака.
 */
function frameFilters(loop: VideoLoopPolicy, rendition: VideoRendition, source: Probe): string {
  const width = Math.min(source.width, rendition.width);
  const fps = Math.min(Math.round(source.fps) || loop.targetFps, loop.targetFps);

  const chain: string[] = [];
  if (loop.removeWatermark) {
    const { x, y, width: w, height: h } = loop.removeWatermark;
    chain.push(`delogo=x=${x}:y=${y}:w=${w}:h=${h}`);
  }
  chain.push(`scale=${width}:-2`, `fps=${fps}`);
  /*
   * Переворот идёт ПОСЛЕДНИМ.
   *
   * Фильтр `reverse` буферизует весь клип в памяти, поэтому кадры должны прийти к
   * нему уже уменьшенными и с нужной частотой: перевернуть 1080p и потом уменьшить
   * значило бы держать в памяти вчетверо больше данных без всякой пользы.
   */
  if (loop.reversed) chain.push('reverse');
  return chain.join(',');
}

/**
 * Аргументы обработки кадра — либо простой `-vf`, либо граф со склейкой шва.
 *
 * Склейка. Исходник, который не является петлёй, на шве даёт скачок: последний
 * кадр не совпадает с первым. Лечится это так: хвост длиной X растворяется в
 * первые X секунд, а дальше идёт середина клипа. Тогда петля начинается кадром
 * `A(D−X)` и им же заканчивается, то есть смыкается сама с собой.
 *
 *   выход = xfade(A[D−X … D], A[0 … X]) + A[X … D−X]
 *
 * Длительность выхода — `D − X`, и это цена приёма: полторы секунды исходника
 * уходят на растворение.
 */
function videoArgs(
  loop: VideoLoopPolicy,
  rendition: VideoRendition,
  source: Probe,
  duration: number,
): { args: string[]; duration: number } {
  const filters = frameFilters(loop, rendition, source);
  const seam = loop.seamCrossfadeSeconds;

  if (seam <= 0 || duration <= seam * 2) {
    return { args: ['-t', String(duration), '-vf', filters], duration };
  }

  const head = seam;
  const tailStart = duration - seam;
  const graph = [
    `[0:v]${filters},split=3[h][m][t]`,
    `[h]trim=0:${head},setpts=PTS-STARTPTS[head]`,
    `[t]trim=${tailStart}:${duration},setpts=PTS-STARTPTS[tail]`,
    `[m]trim=${head}:${tailStart},setpts=PTS-STARTPTS[mid]`,
    `[tail][head]xfade=transition=fade:duration=${seam}:offset=0[seamed]`,
    `[seamed][mid]concat=n=2:v=1[out]`,
  ].join(';');

  return {
    args: ['-filter_complex', graph, '-map', '[out]'],
    duration: duration - seam,
  };
}

interface Encoded {
  format: Format;
  width: number;
  file: string;
  bytes: number;
}

/**
 * Параметры x264. Отдельной функцией, потому что `-x264-params` принимает ОДНУ
 * строку: дописать ключевые кадры вторым флагом нельзя — второй `-x264-params`
 * перебивает первый, и адаптивное квантование в тенях молча теряется.
 */
function x264Params(loop: VideoLoopPolicy): string {
  const params = ['aq-mode=3', 'aq-strength=1.1'];
  if (loop.scrub) {
    const interval = loop.scrub.keyframeIntervalFrames;
    params.push(`keyint=${interval}`, `min-keyint=${interval}`, 'scenecut=0');
  }
  return params.join(':');
}

function encode(
  loop: VideoLoopPolicy,
  rendition: VideoRendition,
  format: Format,
  input: string,
  source: Probe,
  duration: number,
): Encoded {
  const bitrate = `${rendition.bitrateKbps[format]}k`;
  const video = videoArgs(loop, rendition, source, duration);
  /** Звук удаляется всегда: петля беззвучна, дорожка — только вес. */
  const noAudio = loop.stripAudio ? ['-an'] : [];

  /*
   * Параметры кодеков подобраны под материал: тёмная сцена, плавные градиенты
   * дыма и света, мелкие боке-частицы. На таком материале битрейт сам по себе
   * проблему не решает — нужно, чтобы кодек не «выравнивал» тени.
   *
   * `aq-mode=3` у x264 — главное здесь: адаптивное квантование с уклоном в
   * тёмные области. Без него биты уходят на светлые участки, а в тенях остаются
   * полосы, и они видны тем сильнее, чем больше кадр открыт. `tune=film`
   * сохраняет зерно и мелкие частицы вместо того, чтобы принять их за шум и
   * сгладить.
   *
   * У VP9 та же роль у `aq-mode=2` (вариативное) и `tile-columns`; у SVT-AV1
   * `film-grain` восстанавливает зерно синтетически, но здесь он выключен: на
   * фоне под текстом синтетическое зерно читается как шум сжатия.
   */
  const encoders: Record<Format, string[]> = {
    av1: [
      '-c:v',
      'libsvtav1',
      '-b:v',
      bitrate,
      '-preset',
      '5',
      '-svtav1-params',
      'tune=0:enable-overlays=1',
      '-movflags',
      '+faststart',
    ],
    vp9: [
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      bitrate,
      '-row-mt',
      '1',
      '-tile-columns',
      '2',
      '-aq-mode',
      '2',
      '-deadline',
      'good',
      '-cpu-used',
      '2',
    ],
    h264: [
      '-c:v',
      'libx264',
      '-b:v',
      bitrate,
      '-preset',
      'slow',
      '-tune',
      'film',
      '-profile:v',
      'high',
      '-x264-params',
      x264Params(loop),
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
    ],
  };

  /*
   * Плотные ключевые кадры для клипа, который отматывается прокруткой.
   *
   * `-g` задаёт максимальное расстояние между ключевыми кадрами; для x264 то же
   * число дублируется в `-x264-params` вместе с `min-keyint`, иначе энкодер
   * оставляет за собой право поставить ключевой кадр реже. `scenecut=0` — по той
   * же причине: смен сцены в клипе нет, и автоматика только сбивала бы шаг.
   *
   * Без этого отматывание идёт ступенями: браузер показывает ближайший
   * предыдущий ключевой кадр, а не тот, который запрошен.
   */
  const keyframes = loop.scrub
    ? ['-g', String(loop.scrub.keyframeIntervalFrames), '-keyint_min', String(loop.scrub.keyframeIntervalFrames)]
    : [];

  const temporary = join(OUT_DIR, `${loop.baseName}.encoding${FILE_SUFFIX[format]}`);

  run('ffmpeg', [
    '-y',
    '-i',
    input,
    ...video.args,
    ...noAudio,
    ...encoders[format],
    ...keyframes,
    temporary,
  ]);

  /*
   * Имя получается ПОСЛЕ кодирования, потому что отпечаток считается по готовому
   * файлу. Промежуточное имя содержит `.encoding`, чтобы недописанный файл не
   * прошёл разбор и не попал в манифест, если кодирование прервётся.
   */
  const actualWidth = Math.min(source.width, rendition.width);
  const finalName = loopFileName(loop.baseName, actualWidth, format, fingerprintOf(temporary));
  const output = join(OUT_DIR, finalName);
  if (existsSync(output)) rmSync(output);
  renameSync(temporary, output);

  return { format, width: actualWidth, file: finalName, bytes: statSync(output).size };
}

/**
 * Удалить прежние файлы петли — в обеих схемах имён.
 *
 * Обязательно перед кодированием: имена содержат отпечаток, поэтому новый файл не
 * перезапишет старый — они просто накопятся в папке, а `video:check` увидит по
 * два файла одного формата и не сможет сказать, какой из них живой. Файлы прежней
 * схемы удаляются здесь же, иначе они остались бы в папке навсегда и уехали в
 * деплой мёртвым грузом.
 */
function removePreviousFiles(loop: VideoLoopPolicy): number {
  if (!existsSync(OUT_DIR)) return 0;

  let removed = 0;
  for (const name of readdirSync(OUT_DIR)) {
    if (!belongsToLoop(loop.baseName, name)) continue;
    rmSync(join(OUT_DIR, name));
    removed += 1;
  }
  return removed;
}

/**
 * Постер — ПЕРВЫЙ кадр петли, снятый до сжатия.
 *
 * Два решения, и оба важны для того, чтобы подмена постера видео была невидимой.
 *
 * 1. **Кадр берётся из графа фильтров, а не из готового файла.** Прогон тот же
 *    самый (`videoArgs`), но с `-frames:v 1`: на выходе — тот кадр, который все
 *    три формата затем приближают каждый со своими потерями. Взять его из
 *    AV1-файла значило бы привязать постер к артефактам одного кодека, хотя в
 *    браузере может играть любой из трёх.
 * 2. **Кадр именно первый.** После склейки шва петля начинается НЕ там, где
 *    начинался клип, и постер из исходника не совпал бы с первым кадром видео —
 *    при старте воспроизведения был бы виден скачок ровно в тот момент, когда на
 *    него смотрят. Поэтому кадр снимается с того же графа, что и петля.
 *
 * PNG, а не WebP: файл попадает в `public/media/seed` как исходник и проходит
 * общий конвейер изображений (`npm run media:optimize`) вместе со всеми
 * остальными ассетами. Второго способа готовить картинки в проекте нет.
 */
function extractPoster(
  loopKey: VideoLoopKey,
  loop: VideoLoopPolicy,
  input: string,
  source: Probe,
  duration: number,
): string {
  const name = `${posterAssetName(loopKey)}.png`;
  mkdirSync(SEED_DIR, { recursive: true });

  /* Самая широкая версия: постер обязан быть не хуже кадра, который он подменяет. */
  const widest = loop.renditions.reduce((max, item) => (item.width > max.width ? item : max));
  const video = videoArgs(loop, widest, source, duration);

  run('ffmpeg', ['-y', '-i', input, ...video.args, '-frames:v', '1', join(SEED_DIR, name)]);

  return name;
}

/* ────────────────────────────────────────────────────────────────────────────
   МАНИФЕСТ
   ──────────────────────────────────────────────────────────────────────────── */

interface LoopManifest {
  sources: Encoded[];
  durationSeconds: number;
}

/**
 * Манифест собирается по СОДЕРЖИМОМУ папки, а не по результату этого запуска.
 *
 * Так сделано ради единственного важного свойства: закодировать одну петлю можно,
 * не имея исходника второй. Исходник hero живёт вне репозитория (21,6 МБ), и
 * попытка «пересобрать манифест из того, что только что закодировано» затирала бы
 * данные о петле, которую в этот раз не трогали.
 */
/**
 * Манифест собирается по СОДЕРЖИМОМУ папки, а не по результату этого запуска.
 *
 * Так сделано ради единственного важного свойства: закодировать одну петлю можно,
 * не имея исходника второй. Исходник hero живёт вне репозитория (20,6 МБ), и
 * попытка «пересобрать манифест из того, что только что закодировано» затирала бы
 * данные о петле, которую в этот раз не трогали.
 *
 * Файлы НЕ сопоставляются с версиями из политики, и это важно: закодированная
 * ширина равна `min(ширина исходника, ширина версии)`, а ширины исходника здесь
 * нет. Прежняя попытка сопоставлять приводила к тому, что версия 1920 находила
 * файл 1280 (тот тоже проходил условие «не шире»), обе версии указывали на один
 * файл, а файлы 1920 в манифест не попадали вовсе — на десктопе играла узкая
 * версия. Поэтому источником истины служат сами файлы: ширина и формат читаются
 * из имени, а порядок задаётся ими же.
 */
function collectManifest(): Record<VideoLoopKey, LoopManifest> {
  const files = existsSync(OUT_DIR) ? readdirSync(OUT_DIR) : [];
  const manifest = {} as Record<VideoLoopKey, LoopManifest>;

  for (const key of videoLoopKeys) {
    const { baseName, formats } = videoLoopPolicy[key];

    const sources: Encoded[] = files
      .flatMap((file) => {
        const identity = identify(baseName, file);
        if (identity === null) return [];
        return [
          {
            format: identity.format,
            width: identity.width,
            file,
            bytes: statSync(join(OUT_DIR, file)).size,
          },
        ];
      })
      /*
       * Порядок — часть данных, а не деталь файловой системы: сначала по
       * возрастанию ширины, внутри ширины по приоритету формата из политики.
       * Именно в этом порядке источники перебираются в браузере.
       */
      .sort(
        (a, b) =>
          a.width - b.width || formats.indexOf(a.format) - formats.indexOf(b.format),
      );

    const first = sources[0];
    manifest[key] = {
      sources,
      durationSeconds: first
        ? Math.round(probe(join(OUT_DIR, first.file)).duration * 100) / 100
        : 0,
    };
  }

  return manifest;
}

function renderGenerated(manifest: Record<VideoLoopKey, LoopManifest>): string {
  const loops = videoLoopKeys
    .map((key) => {
      const { sources, durationSeconds } = manifest[key];
      const rows = sources
        .map(
          (item) =>
            `      { format: '${item.format}', width: ${item.width}, file: '${item.file}', bytes: ${item.bytes} },`,
        )
        .join('\n');
      return `  ${key}: {
    sources: [
${rows}
    ],
    durationSeconds: ${durationSeconds},
  },`;
    })
    .join('\n');

  return `/* AUTO-GENERATED by scripts/encode-video-loops.ts — do not edit by hand. */

/**
 * Фоновые петли: реальные файлы, их ширина и вес.
 *
 * Вес хранится здесь, а не считается в рантайме: он нужен отчётам о бюджете и
 * админке до того, как браузер что-то скачает. Ширина нужна выбору источника:
 * узкому экрану незачем качать кадр вчетверо шире, чем он его показывает.
 */
import type { VideoLoopKey } from '@/config/media-processing';

export interface VideoLoopSourceFile {
  format: 'av1' | 'vp9' | 'h264';
  /** Ширина кадра в пикселях. */
  width: number;
  /** Имя файла в \`public/media/video\`. */
  file: string;
  bytes: number;
}

export interface VideoLoopManifest {
  sources: readonly VideoLoopSourceFile[];
  /** Длительность петли, секунды. После склейки шва короче исходника. */
  durationSeconds: number;
}

export const videoLoops: Record<VideoLoopKey, VideoLoopManifest> = {
${loops}
};
`;
}

function writeManifest(): void {
  const manifest = collectManifest();
  writeFileSync(GENERATED, renderGenerated(manifest), 'utf8');
  console.log(`video:encode — записано ${GENERATED.replace(ROOT, '')}`);
}

/**
 * Перевести уже существующие файлы петель на имена с отпечатком и пересобрать
 * манифест — без перекодирования.
 *
 * Нужно по одной практической причине: исходники петель в репозитории не лежат
 * (у первого экрана он весит 21,6 МБ), поэтому перекодировать петлю только ради
 * переименования файла невозможно. Содержимое при переименовании не меняется, и
 * отпечаток считается по нему же — то есть операция обратима и проверяема.
 *
 * Тем же флагом восстанавливается потерянный манифест: он собирается из того, что
 * действительно лежит в папке.
 */
function relink(): void {
  if (!existsSync(OUT_DIR)) {
    console.error(`video:encode --relink — ${OUT_DIR} отсутствует`);
    process.exit(1);
  }

  let renamed = 0;
  let removed = 0;

  for (const key of videoLoopKeys) {
    const { baseName } = videoLoopPolicy[key];

    for (const name of readdirSync(OUT_DIR)) {
      /* Уже в актуальной схеме — трогать нечего. */
      if (identify(baseName, name) !== null) continue;
      if (legacyFormatOf(baseName, name) === null) continue;

      const path = join(OUT_DIR, name);
      const format = legacyFormatOf(baseName, name)!;

      /*
       * Есть ли уже файл этой пары «ширина + формат». Ширина берётся из самого
       * файла, а не угадывается по политике: файл прежней схемы мог быть
       * закодирован под другие настройки, и подписать его чужой шириной значило бы
       * соврать в манифесте.
       */
      const width = probe(path).width;
      const target = loopFileName(baseName, width, format, fingerprintOf(path));

      if (existsSync(join(OUT_DIR, target))) {
        rmSync(path);
        removed += 1;
        console.log(`  удалён остаток прежней схемы: ${name}`);
        continue;
      }

      renameSync(path, join(OUT_DIR, target));
      renamed += 1;
      console.log(`  ${name} → ${target}`);
    }
  }

  console.log(`video:encode --relink — переименовано ${renamed}, удалено остатков ${removed}`);
  writeManifest();
}

/* ────────────────────────────────────────────────────────────────────────────
   ПРОВЕРКА
   ──────────────────────────────────────────────────────────────────────────── */

function checkOnly(): void {
  if (!existsSync(OUT_DIR)) {
    console.error(`video:check — ${OUT_DIR} отсутствует. Выполните: npm run video:encode`);
    process.exit(1);
  }

  const files = readdirSync(OUT_DIR);
  const problems: string[] = [];
  let counted = 0;
  let total = 0;

  for (const key of videoLoopKeys) {
    const loop = videoLoopPolicy[key];
    const own = files.filter((name) => identify(loop.baseName, name) !== null);

    if (own.length === 0) {
      problems.push(`${key}: файлов петли нет. Выполните: npm run video:encode -- --loop ${key}`);
      continue;
    }

    /*
     * Два файла на одну пару «ширина + формат» — след неудачного переэнкода: имена
     * содержат отпечаток содержимого, поэтому новый файл не перезаписывает
     * старый. Живой из них тот, что в манифесте, но браузеру об этом никто не
     * скажет, а в деплой уйдут оба.
     */
    const seen = new Map<string, string[]>();
    for (const name of own) {
      const { format, width } = identify(loop.baseName, name)!;
      const slot = `${width}px ${format}`;
      seen.set(slot, [...(seen.get(slot) ?? []), name]);
    }
    for (const [slot, names] of seen) {
      if (names.length > 1) {
        problems.push(
          `${key}: ${slot} представлен ${names.length} файлами (${names.join(', ')}) — ` +
            'лишние остались от прежнего кодирования, перекодируйте петлю',
        );
      }
    }

    /*
     * Версий должно быть столько, сколько объявлено в политике. Сравнение по
     * ЧИСЛУ различных ширин, а не по конкретным значениям: закодированная ширина
     * равна `min(ширина исходника, ширина версии)`, и у исходника уже 720p версия
     * в 1920 законно окажется файлом 1280. Требовать точных значений значило бы
     * падать на нормальном исходнике.
     */
    const widths = new Set(own.map((name) => identify(loop.baseName, name)!.width));
    if (widths.size < loop.renditions.length) {
      problems.push(
        `${key}: версий кадра ${widths.size} (${[...widths].sort((a, b) => a - b).join(', ')}px), ` +
          `а в политике ${loop.renditions.length} — перекодируйте петлю целиком`,
      );
    }

    for (const name of own) {
      const bytes = statSync(join(OUT_DIR, name)).size;
      counted += 1;
      total += bytes;
      if (bytes > loop.maxBytes) {
        problems.push(
          `${name}: ${(bytes / 1024).toFixed(0)} KB > бюджет ${(loop.maxBytes / 1024).toFixed(0)} KB`,
        );
      }
    }
  }

  /* Файл, не принадлежащий ни одной петле, попадёт в деплой и никем не учтён. */
  for (const name of files) {
    const known = videoLoopKeys.some((key) => identify(videoLoopPolicy[key].baseName, name) !== null);
    if (!known) problems.push(`${name}: не принадлежит ни одной петле из videoLoopPolicy`);
  }

  if (problems.length > 0) {
    console.error(`video:check — проблемы:\n  • ${problems.join('\n  • ')}`);
    process.exit(1);
  }

  console.log(
    `video:check — OK (${videoLoopKeys.length} петли, ${counted} файла, суммарно ${(total / 1024).toFixed(0)} KB)`,
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   ГЛАВНАЯ
   ──────────────────────────────────────────────────────────────────────────── */

function main(): void {
  const { loop: loopKey, input, check, relink: shouldRelink } = args();

  if (check) {
    checkOnly();
    return;
  }

  if (shouldRelink) {
    relink();
    return;
  }

  if (loopKey === null) {
    console.error(
      `video:encode — укажите петлю: --loop ${videoLoopKeys.join('|')}\n` +
        '  Исходник: --input "путь\\к\\файлу.mp4"',
    );
    process.exit(1);
  }

  if (input === null) {
    console.error(
      'video:encode — укажите исходник: --input "путь\\к\\файлу.mp4"\n' +
        '  Исходники в репозитории не хранятся: видео в git утяжеляет каждый клон навсегда.',
    );
    process.exit(1);
  }

  if (!hasTool('ffmpeg') || !hasTool('ffprobe')) {
    console.error(
      'video:encode — нужны ffmpeg и ffprobe в PATH.\n' +
        '  Файлы петель уже лежат в public/media/video, переэнкод нужен только при\n' +
        '  смене исходника или бюджета. Установка: winget install Gyan.FFmpeg',
    );
    process.exit(1);
  }

  if (!existsSync(input)) {
    console.error(`video:encode — исходник не найден: ${input}`);
    process.exit(1);
  }

  const loop = videoLoopPolicy[loopKey];
  mkdirSync(OUT_DIR, { recursive: true });

  const source = probe(input);
  console.log(
    `video:encode — петля «${loopKey}», исходник ${source.width}×${source.height}, ` +
      `${source.fps.toFixed(0)} fps, ${source.duration.toFixed(1)} с, ` +
      `${(statSync(input).size / 1024 / 1024).toFixed(1)} МБ`,
  );
  if (loop.removeWatermark) console.log('  знак генератора заклеивается (delogo)');
  if (loop.seamCrossfadeSeconds > 0) {
    console.log(`  шов склеивается растворением ${loop.seamCrossfadeSeconds} с`);
  }

  const removed = removePreviousFiles(loop);
  if (removed > 0) console.log(`  прежних файлов удалено: ${removed}`);

  const duration = Math.min(source.duration, loop.maxDurationSeconds);
  const encoded: Encoded[] = [];

  for (const rendition of loop.renditions) {
    for (const format of loop.formats) {
      try {
        const result = encode(loop, rendition, format, input, source, duration);
        const overBudget = result.bytes > loop.maxBytes;
        console.log(
          `  ${String(result.width).padStart(4)}px ${format.padEnd(5)} ` +
            `${result.file.padEnd(34)} ${(result.bytes / 1024).toFixed(0).padStart(5)} KB` +
            (overBudget ? '  ПРЕВЫШЕН БЮДЖЕТ' : ''),
        );
        encoded.push(result);
      } catch (error) {
        /*
         * Отсутствие энкодера — не повод останавливать всю сборку: av1 есть не в
         * каждом билде ffmpeg, а h264 и vp9 покрывают все браузеры. Но молчать
         * тоже нельзя: пропущенный формат означает больший трафик у части
         * пользователей.
         */
        console.warn(`  ${format.padEnd(5)} пропущен: энкодер недоступен в этой сборке ffmpeg`);
        if (process.env.CI) throw error;
      }
    }
  }

  if (encoded.length === 0) {
    console.error('video:encode — не удалось закодировать ни один формат');
    process.exit(1);
  }

  const poster = loop.extractsPoster
    ? extractPoster(loopKey, loop, input, source, duration)
    : null;
  if (poster !== null) {
    console.log(`  постер ${poster} — первый кадр петли до сжатия (дальше: npm run media:optimize)`);
  } else {
    console.log('  постер не снимается: у этой петли его роль исполняет другая');
  }

  writeManifest();
  console.log('  Дальше: npm run media:optimize && npm run video:check');
}

main();

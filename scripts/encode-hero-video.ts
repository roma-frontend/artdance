/**
 * Кодирование фоновой петли первого экрана.
 *
 *   npm run video:encode           — закодировать из исходника макета
 *   npm run video:encode -- --input <path>
 *   npm run video:check            — проверить, что файлы на месте и в бюджете
 *
 * Зачем скрипт, а не команда в README: параметры кодирования обязаны меняться
 * вместе с бюджетом (`videoProcessing.heroLoop`), а не отдельно от него. Здесь
 * они читаются из конфига, результат проверяется по весу, а размеры попадают в
 * генерируемый манифест — компонент не выдумывает вес файла, он его знает.
 *
 * Исходник из макета — 20,6 МБ, 1920×1080, 24 fps, 8 секунд. В таком виде он на
 * первом экране неприемлем: трафик тратится до того, как пользователь увидел
 * первое слово. Задача скрипта — получить из него петлю в пределах бюджета.
 *
 * Требуется `ffmpeg` и `ffprobe` в PATH. Без них скрипт не падает молча, а
 * объясняет, что делать: файлы петли лежат в репозитории, и переэнкод нужен
 * только при смене исходника или бюджета.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { videoProcessing } from '../src/config/media-processing.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT_DIR = join(ROOT, 'public', 'media', 'video');
const GENERATED = join(ROOT, 'src', 'design', 'hero-video.generated.ts');

/** Путь по умолчанию совпадает с источником `npm run design:import`. */
const DEFAULT_INPUT = join(
  'C:',
  'Users',
  'namel',
  'Desktop',
  'artdance-deploy',
  'photos',
  'dancer-fhd.mp4',
);

const BASE_NAME = 'hero-loop';

const { heroLoop } = videoProcessing;

interface Encoded {
  format: (typeof heroLoop.formats)[number];
  file: string;
  bytes: number;
}

function args(): { input: string; check: boolean } {
  const argv = process.argv.slice(2);
  const inputIndex = argv.indexOf('--input');
  return {
    input: inputIndex >= 0 ? (argv[inputIndex + 1] ?? DEFAULT_INPUT) : DEFAULT_INPUT,
    check: argv.includes('--check'),
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

/** Параметры исходника: без них нельзя решить, что уменьшать. */
function probe(input: string): { width: number; height: number; fps: number; duration: number } {
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
 * Кодирование одного формата.
 *
 * `fps` берётся как минимум из исходника и бюджета: повышать частоту нельзя —
 * `fps` в ffmpeg дублирует кадры, файл растёт, а плавности не прибавляется.
 * Ширина — тоже минимум: апскейл фонового кадра бессмысленен.
 */
function encode(
  format: Encoded['format'],
  input: string,
  source: ReturnType<typeof probe>,
): Encoded {
  const duration = Math.min(source.duration, heroLoop.maxDurationSeconds);
  const fps = Math.min(Math.round(source.fps) || heroLoop.targetFps, heroLoop.targetFps);
  const width = Math.min(source.width, heroLoop.maxWidth);
  const bitrate = `${heroLoop.bitrateKbps[format]}k`;
  const filters = `scale=${width}:-2,fps=${fps}`;

  const common = ['-y', '-i', input, '-t', String(duration), '-vf', filters];
  /** Звук удаляется всегда: петля беззвучна, дорожка — только вес. */
  const noAudio = heroLoop.stripAudio ? ['-an'] : [];

  const byFormat: Record<Encoded['format'], { file: string; encoder: string[] }> = {
    av1: {
      file: `${BASE_NAME}.av1.mp4`,
      encoder: ['-c:v', 'libsvtav1', '-b:v', bitrate, '-preset', '6', '-movflags', '+faststart'],
    },
    vp9: {
      file: `${BASE_NAME}.webm`,
      encoder: ['-c:v', 'libvpx-vp9', '-b:v', bitrate, '-row-mt', '1'],
    },
    h264: {
      file: `${BASE_NAME}.mp4`,
      encoder: [
        '-c:v',
        'libx264',
        '-b:v',
        bitrate,
        '-preset',
        'slow',
        '-profile:v',
        'high',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
      ],
    },
  };

  const { file, encoder } = byFormat[format];
  const output = join(OUT_DIR, file);

  run('ffmpeg', [...common, ...noAudio, ...encoder, output]);

  return { format, file, bytes: statSync(output).size };
}

/**
 * Постер НЕ извлекается здесь.
 *
 * Он уже объявлен в `design/asset-manifest.ts` (`designVideos[].poster`) и
 * является первым кадром этой же петли, обработанным общим конвейером изображений
 * (`hero-dancer`, 56 KB webp). Извлекать второй файл значило бы держать в
 * репозитории два постера и решать, какой из них правдивее.
 */
function renderGenerated(encoded: readonly Encoded[], durationSeconds: number): string {
  const sources = encoded
    .map(
      (item) =>
        `  { format: '${item.format}', file: '${item.file}', bytes: ${item.bytes} },`,
    )
    .join('\n');

  return `/* AUTO-GENERATED by scripts/encode-hero-video.ts — do not edit by hand. */

/**
 * Фоновая петля первого экрана: реальные файлы и их вес.
 *
 * Вес хранится здесь, а не считается в рантайме: он нужен отчётам о бюджете и
 * админке до того, как браузер что-то скачает.
 */
export interface HeroVideoSourceFile {
  format: 'av1' | 'vp9' | 'h264';
  /** Имя файла в \`public/media/video\`. */
  file: string;
  bytes: number;
}

export const heroVideoSources: readonly HeroVideoSourceFile[] = [
${sources}
];

/** Длительность петли, секунды. */
export const heroVideoDurationSeconds = ${durationSeconds};
`;
}

function checkOnly(): void {
  if (!existsSync(OUT_DIR)) {
    console.error(`video:check — ${OUT_DIR} отсутствует. Выполните: npm run video:encode`);
    process.exit(1);
  }

  const files = readdirSync(OUT_DIR).filter((name) => name.startsWith(BASE_NAME));
  if (files.length === 0) {
    console.error('video:check — файлов петли нет. Выполните: npm run video:encode');
    process.exit(1);
  }

  const problems: string[] = [];
  let total = 0;

  for (const name of files) {
    const bytes = statSync(join(OUT_DIR, name)).size;
    total += bytes;
    if (bytes > heroLoop.maxBytes) {
      problems.push(
        `${name}: ${(bytes / 1024).toFixed(0)} KB > бюджет ${(heroLoop.maxBytes / 1024).toFixed(0)} KB`,
      );
    }
  }

  if (problems.length > 0) {
    console.error(`video:check — превышен бюджет петли:\n  • ${problems.join('\n  • ')}`);
    process.exit(1);
  }

  console.log(
    `video:check — OK (${files.length} файла, суммарно ${(total / 1024).toFixed(0)} KB)`,
  );
}

function main(): void {
  const { input, check } = args();

  if (check) {
    checkOnly();
    return;
  }

  if (!hasTool('ffmpeg') || !hasTool('ffprobe')) {
    console.error(
      'video:encode — нужны ffmpeg и ffprobe в PATH.\n' +
        '  Файлы петли уже лежат в public/media/video, переэнкод нужен только при\n' +
        '  смене исходника или бюджета. Установка: winget install Gyan.FFmpeg',
    );
    process.exit(1);
  }

  if (!existsSync(input)) {
    console.error(`video:encode — исходник не найден: ${input}`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const source = probe(input);
  console.log(
    `video:encode — исходник ${source.width}×${source.height}, ` +
      `${source.fps.toFixed(0)} fps, ${source.duration.toFixed(1)} с, ` +
      `${(statSync(input).size / 1024 / 1024).toFixed(1)} МБ`,
  );

  const encoded: Encoded[] = [];
  for (const format of heroLoop.formats) {
    try {
      const result = encode(format, input, source);
      const overBudget = result.bytes > heroLoop.maxBytes;
      console.log(
        `  ${format.padEnd(5)} ${result.file.padEnd(22)} ` +
          `${(result.bytes / 1024).toFixed(0).padStart(5)} KB` +
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

  if (encoded.length === 0) {
    console.error('video:encode — не удалось закодировать ни один формат');
    process.exit(1);
  }

  const posterNote = 'постер объявлен в design/asset-manifest.ts (designVideos[].poster)';
  console.log(`  ${posterNote}`);

  const duration = Math.min(source.duration, heroLoop.maxDurationSeconds);
  writeFileSync(GENERATED, renderGenerated(encoded, duration), 'utf8');
  console.log(`video:encode — записано ${GENERATED.replace(ROOT, '')}`);
  console.log('  Дальше: npm run video:check');
}

main();

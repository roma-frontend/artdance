/**
 * Конвейер обработки изображений.
 *
 * Один и тот же код обслуживает два входа:
 *   • загрузку пользователя (route handler → R2);
 *   • подготовку ассетов репозитория (`npm run media:optimize`).
 *
 * Это сделано намеренно: если сжатие сид-изображений живёт в отдельном скрипте
 * со своими числами, оно неизбежно разойдётся с продакшен-загрузкой, и «у нас
 * же оптимизировано» перестанет быть правдой для того, что грузят инструкторы.
 *
 * Что делает конвейер и почему (политика — в `src/config/media.ts`):
 *
 * 1. **Определяет реальный формат по содержимому.** `Content-Type` от клиента —
 *    утверждение, а не факт; `validateUpload` отсекает явную подделку, но
 *    окончательное слово за декодером.
 * 2. **Отклоняет декомпрессионные бомбы** по числу пикселей. Ограничение в
 *    байтах от них не спасает: 20 KB PNG разворачивается в 1,6 Gpx.
 * 3. **Применяет ориентацию из EXIF и удаляет метаданные.** GPS-координаты в
 *    фото инструктора — это его домашний адрес. Ориентация применяется ДО
 *    удаления, иначе портреты с телефона лягут набок.
 * 4. **Ре-энкодит в AVIF и WebP** — один раз при загрузке, а не при каждом
 *    показе. Заодно это разрывает связь с исходным контейнером: polyglot-файл
 *    (валидный PNG и валидный HTML одновременно) после ре-энкода перестаёт быть
 *    исполняемым.
 * 5. **Считает `blurDataUrl` и реальные размеры** — оба поля нужны, чтобы
 *    `next/image` зарезервировал место и не дал скачка вёрстки.
 *
 * Коды отказа возвращаются для i18n, а не готовым текстом — как в
 * `src/lib/security/uploads.ts`.
 */

import sharp, { type Metadata, type Sharp } from 'sharp';

import type { ImagePresetKey } from '@/config/media';
import {
  mediaProcessing,
  presetBudget,
  type MediaOutputFormat,
} from '@/config/media-processing';

/* ───────────────────────────── Типы ───────────────────────────── */

export type MediaRejection =
  | { code: 'MEDIA_UNREADABLE'; params: Record<string, never> }
  | { code: 'MEDIA_FORMAT_UNSUPPORTED'; params: { format: string } }
  | { code: 'MEDIA_TOO_MANY_PIXELS'; params: { maxMegapixels: number } }
  | { code: 'MEDIA_TOO_SMALL'; params: { min: number } }
  | { code: 'MEDIA_ANIMATED'; params: Record<string, never> };

export interface RenderedImage {
  width: number;
  height: number;
  format: MediaOutputFormat;
  bytes: number;
  data: Buffer;
}

export interface ProcessedImage {
  /** Размеры мастера — пишутся в `MediaAsset.width/height`. */
  width: number;
  height: number;
  /** Формат исходника, определённый по содержимому. Только для аудита. */
  sourceFormat: string;
  /** Полноразмерная версия в предпочитаемом формате. */
  master: RenderedImage;
  /** Производные по ширинам из конфига. Не содержит апскейлов. */
  variants: readonly RenderedImage[];
  /** Инлайн-плейсхолдер для `next/image`. */
  blurDataUrl: string;
  /** Сумма байт всего, что уйдёт в хранилище. */
  totalBytes: number;
  /** Байт исходника — для отчёта об экономии. */
  sourceBytes: number;
}

export type IngestResult =
  | { ok: true; image: ProcessedImage }
  | { ok: false; rejection: MediaRejection };

export interface ProcessOptions {
  /**
   * Роль изображения. Определяет бюджет веса при проверке; на само сжатие не
   * влияет — качество едино для всей платформы.
   */
  preset?: ImagePresetKey;
  /** Переопределение набора ширин. По умолчанию — `mediaProcessing.variantWidths`. */
  widths?: readonly number[];
  /** Переопределение форматов. По умолчанию — `mediaProcessing.outputFormats`. */
  formats?: readonly MediaOutputFormat[];
  /** Не генерировать производные (нужно для аватаров: одна ширина). */
  masterOnly?: boolean;
  /**
   * Максимальная сторона мастера. По умолчанию — `masterMaxDimension`.
   * Переопределяется для ассетов репозитория (`mediaProcessing.seedMaxWidth`).
   */
  maxDimension?: number;
}

/* ──────────────────── Чистые проверки (тестируются отдельно) ──────────────────── */

/** Превышен предел пикселей. Проверяется до полного декодирования. */
export function exceedsPixelBudget(width: number, height: number): boolean {
  return width * height > mediaProcessing.maxInputPixels;
}

/** Слишком мелкое изображение: чаще всего это иконка или трекинг-пиксель. */
export function belowMinimumDimension(width: number, height: number): boolean {
  return Math.min(width, height) < mediaProcessing.minDimension;
}

/** Многокадровый файл (GIF, анимированный WebP). `pages` есть только у таких. */
export function isAnimated(metadata: { pages?: number }): boolean {
  return (metadata.pages ?? 1) > 1;
}

/** Формат распознан и разрешён к декодированию. */
export function isDecodableFormat(format: string | undefined): boolean {
  if (!format) return false;
  return (mediaProcessing.decodableFormats as readonly string[]).includes(format);
}

/**
 * Ширины, которые имеет смысл генерировать: апскейл запрещён, а ширина мастера
 * добавляется всегда — без неё нет варианта для крупных экранов.
 */
export function plannedWidths(masterWidth: number, widths: readonly number[]): number[] {
  const planned = new Set<number>();
  for (const width of widths) {
    if (width < masterWidth) planned.add(width);
  }
  planned.add(masterWidth);
  return [...planned].sort((a, b) => a - b);
}

/** Уложился ли файл в бюджет своей роли. */
export function withinBudget(bytes: number, preset: ImagePresetKey): boolean {
  return bytes <= mediaProcessing.budgetBytes[presetBudget[preset]];
}

/** Бюджет в байтах для роли — чтобы сообщение об ошибке содержало число. */
export function budgetFor(preset: ImagePresetKey): number {
  return mediaProcessing.budgetBytes[presetBudget[preset]];
}

/* ──────────────────────────── Конвейер ──────────────────────────── */

function encode(pipeline: Sharp, format: MediaOutputFormat): Sharp {
  switch (format) {
    case 'avif':
      return pipeline.avif({
        quality: mediaProcessing.quality.avif,
        effort: mediaProcessing.avifEffort,
      });
    case 'webp':
      return pipeline.webp({ quality: mediaProcessing.quality.webp });
  }
}

/**
 * Проверка входа без полной обработки: используется route handler'ом, чтобы
 * отказать до траты CPU на энкодинг.
 */
export async function inspectImage(
  input: Buffer,
): Promise<{ ok: true; width: number; height: number; format: string } | { ok: false; rejection: MediaRejection }> {
  let metadata: Metadata;
  try {
    metadata = await sharp(input, {
      limitInputPixels: mediaProcessing.maxInputPixels,
      failOn: 'error',
    }).metadata();
  } catch {
    return { ok: false, rejection: { code: 'MEDIA_UNREADABLE', params: {} } };
  }

  if (!isDecodableFormat(metadata.format)) {
    return {
      ok: false,
      rejection: { code: 'MEDIA_FORMAT_UNSUPPORTED', params: { format: metadata.format ?? 'unknown' } },
    };
  }

  if (!mediaProcessing.allowAnimated && isAnimated(metadata)) {
    return { ok: false, rejection: { code: 'MEDIA_ANIMATED', params: {} } };
  }

  /** После `rotate()` стороны меняются местами — считаем итоговые. */
  const rotated = (metadata.orientation ?? 1) >= 5;
  const width = (rotated ? metadata.height : metadata.width) ?? 0;
  const height = (rotated ? metadata.width : metadata.height) ?? 0;

  if (width === 0 || height === 0) {
    return { ok: false, rejection: { code: 'MEDIA_UNREADABLE', params: {} } };
  }

  if (exceedsPixelBudget(width, height)) {
    return {
      ok: false,
      rejection: {
        code: 'MEDIA_TOO_MANY_PIXELS',
        params: { maxMegapixels: Math.round(mediaProcessing.maxInputPixels / 1_000_000) },
      },
    };
  }

  if (belowMinimumDimension(width, height)) {
    return {
      ok: false,
      rejection: { code: 'MEDIA_TOO_SMALL', params: { min: mediaProcessing.minDimension } },
    };
  }

  return { ok: true, width, height, format: metadata.format ?? 'unknown' };
}

/**
 * Полная обработка. Возвращает всё, что нужно записать в хранилище и в
 * `MediaAsset`, и ничего не пишет сама — за запись отвечает вызывающий код.
 * Это делает функцию тестируемой и переиспользуемой в скриптах.
 */
export async function processImage(input: Buffer, options: ProcessOptions = {}): Promise<IngestResult> {
  const inspection = await inspectImage(input);
  if (!inspection.ok) return inspection;

  const formats = options.formats ?? mediaProcessing.outputFormats;
  const preferredFormat = formats[0];
  if (!preferredFormat) return { ok: false, rejection: { code: 'MEDIA_UNREADABLE', params: {} } };

  /**
   * `rotate()` без аргументов применяет EXIF-ориентацию. Метаданные при этом не
   * переносятся в результат: sharp копирует их только по явному
   * `withMetadata()`, которого здесь нет и быть не должно.
   */
  const base = sharp(input, {
    limitInputPixels: mediaProcessing.maxInputPixels,
    failOn: 'error',
  }).rotate();

  const maxDimension = options.maxDimension ?? mediaProcessing.masterMaxDimension;

  const masterBuffer = await encode(
    base.clone().resize({
      width: maxDimension,
      height: maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    }),
    preferredFormat,
  ).toBuffer({ resolveWithObject: true });

  const master: RenderedImage = {
    width: masterBuffer.info.width,
    height: masterBuffer.info.height,
    format: preferredFormat,
    bytes: masterBuffer.data.byteLength,
    data: masterBuffer.data,
  };

  const variants: RenderedImage[] = [];

  if (!options.masterOnly) {
    const widths = plannedWidths(master.width, options.widths ?? mediaProcessing.variantWidths);

    for (const format of formats) {
      for (const width of widths) {
        /** Мастер в предпочитаемом формате уже собран — не дублируем работу. */
        if (format === preferredFormat && width === master.width) continue;

        const rendered = await encode(
          base.clone().resize({ width, withoutEnlargement: true }),
          format,
        ).toBuffer({ resolveWithObject: true });

        variants.push({
          width: rendered.info.width,
          height: rendered.info.height,
          format,
          bytes: rendered.data.byteLength,
          data: rendered.data,
        });
      }
    }
  }

  const blur = await sharp(master.data)
    .resize({ width: mediaProcessing.blur.width })
    .webp({ quality: mediaProcessing.blur.quality })
    .toBuffer();

  const totalBytes = master.bytes + variants.reduce((sum, variant) => sum + variant.bytes, 0);

  return {
    ok: true,
    image: {
      width: master.width,
      height: master.height,
      sourceFormat: inspection.format,
      master,
      variants,
      blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
      totalBytes,
      sourceBytes: input.byteLength,
    },
  };
}


/**
 * Описание уже готового файла: размеры и blur-плейсхолдер **из этих самых байт**,
 * без ре-энкода.
 *
 * Нужно для идемпотентности: `npm run media:check` должен получать тот же
 * результат, что записал `media:optimize`. Если плейсхолдер каждый раз
 * пересчитывается из нового кодирования, сгенерированный манифест «устаревает»
 * на каждом запуске, и проверка в CI становится ложноположительной.
 */
export async function describeImage(
  input: Buffer,
): Promise<{ width: number; height: number; bytes: number; blurDataUrl: string }> {
  const image = sharp(input, { limitInputPixels: mediaProcessing.maxInputPixels, failOn: 'error' });
  const metadata = await image.metadata();

  const blur = await sharp(input)
    .resize({ width: mediaProcessing.blur.width })
    .webp({ quality: mediaProcessing.blur.quality })
    .toBuffer();

  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    bytes: input.byteLength,
    blurDataUrl: `data:image/webp;base64,${blur.toString('base64')}`,
  };
}

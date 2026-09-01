import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { mediaProcessing } from '@/config/media-processing';

import {
  belowMinimumDimension,
  budgetFor,
  exceedsPixelBudget,
  inspectImage,
  isAnimated,
  isDecodableFormat,
  plannedWidths,
  processImage,
  withinBudget,
} from './ingest';

/** Шумная картинка: сплошная заливка сжимается в единицы килобайт и не проверяет ничего. */
async function noiseImage(width: number, height: number, format: 'png' | 'jpeg' = 'png'): Promise<Buffer> {
  const channels = 3;
  const pixels = Buffer.alloc(width * height * channels);
  for (let i = 0; i < pixels.length; i += 1) {
    pixels[i] = (i * 2_654_435_761) % 251;
  }
  const pipeline = sharp(pixels, { raw: { width, height, channels } });
  return format === 'png' ? pipeline.png().toBuffer() : pipeline.jpeg({ quality: 95 }).toBuffer();
}

describe('чистые проверки', () => {
  it('ловит превышение лимита пикселей', () => {
    expect(exceedsPixelBudget(8_000, 5_000)).toBe(false);
    expect(exceedsPixelBudget(40_000, 40_000)).toBe(true);
  });

  it('отклоняет слишком мелкие изображения', () => {
    expect(belowMinimumDimension(mediaProcessing.minDimension, mediaProcessing.minDimension)).toBe(false);
    expect(belowMinimumDimension(1, 1)).toBe(true);
    expect(belowMinimumDimension(2_000, 10)).toBe(true);
  });

  it('распознаёт анимацию по числу кадров', () => {
    expect(isAnimated({})).toBe(false);
    expect(isAnimated({ pages: 1 })).toBe(false);
    expect(isAnimated({ pages: 24 })).toBe(true);
  });

  it('пропускает только разрешённые форматы', () => {
    expect(isDecodableFormat('jpeg')).toBe(true);
    expect(isDecodableFormat('svg')).toBe(false);
    expect(isDecodableFormat(undefined)).toBe(false);
  });

  it('не планирует апскейл и всегда включает ширину мастера', () => {
    expect(plannedWidths(1_000, [420, 768, 1280, 1920])).toEqual([420, 768, 1000]);
    expect(plannedWidths(300, [420, 768])).toEqual([300]);
  });

  it('сверяет вес с бюджетом роли', () => {
    expect(withinBudget(10 * 1024, 'avatar')).toBe(true);
    expect(withinBudget(budgetFor('avatar') + 1, 'avatar')).toBe(false);
    expect(budgetFor('heroFullBleed')).toBeGreaterThan(budgetFor('classCard'));
  });
});

describe('inspectImage', () => {
  it('возвращает размеры и формат для корректного файла', async () => {
    const result = await inspectImage(await noiseImage(800, 600));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({ width: 800, height: 600, format: 'png' });
  });

  it('отклоняет то, что не является изображением', async () => {
    const result = await inspectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    /** SVG декодируется sharp, но запрещён политикой: это вектор XSS. */
    expect(['MEDIA_UNREADABLE', 'MEDIA_FORMAT_UNSUPPORTED']).toContain(result.rejection.code);
  });

  it('отклоняет трекинг-пиксель', async () => {
    const result = await inspectImage(await noiseImage(1, 1));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejection.code).toBe('MEDIA_TOO_SMALL');
  });

  it('учитывает поворот из EXIF при расчёте сторон', async () => {
    /** orientation 6 = повернуть на 90°: 600×800 после поворота становится 800×600. */
    const rotated = await sharp(await noiseImage(600, 800, 'jpeg'))
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const result = await inspectImage(rotated);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result).toMatchObject({ width: 800, height: 600 });
  });
});

describe('processImage', () => {
  it('удаляет метаданные, включая геолокацию', async () => {
    const withExif = await sharp(await noiseImage(600, 400, 'jpeg'))
      .withExif({
        IFD0: { Copyright: 'ArtDance', Make: 'Apple' },
        /** Координаты в центре Еревана — ровно то, что не должно уехать в бакет. */
        IFD3: { GPSLatitude: '40/1 10/1 0/1', GPSLongitude: '44/1 30/1 0/1' },
      })
      .toBuffer();

    const before = await sharp(withExif).metadata();
    expect(before.exif).toBeDefined();

    const result = await processImage(withExif, { formats: ['webp'], masterOnly: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const after = await sharp(result.image.master.data).metadata();
    expect(after.exif).toBeUndefined();
  });

  it('приводит мастер к максимальной стороне из конфига', async () => {
    const oversized = await noiseImage(mediaProcessing.masterMaxDimension + 600, 400);
    const result = await processImage(oversized, { formats: ['webp'], masterOnly: true });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.image.master.width).toBe(mediaProcessing.masterMaxDimension);
    expect(result.image.master.format).toBe('webp');
  });

  it('использует первый формат из конфига как формат мастера', async () => {
    const result = await processImage(await noiseImage(600, 400, 'jpeg'), { masterOnly: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.image.master.format).toBe(mediaProcessing.outputFormats[0]);
  });

  it('не увеличивает изображение, которое меньше целевой ширины', async () => {
    const small = await noiseImage(500, 400);
    const result = await processImage(small, { formats: ['webp'], widths: [320, 768, 1280] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.image.master.width).toBe(500);
    for (const variant of result.image.variants) {
      expect(variant.width).toBeLessThanOrEqual(500);
    }
  });

  it('генерирует производные во всех форматах и не дублирует мастер', async () => {
    const source = await noiseImage(900, 600, 'jpeg');
    const result = await processImage(source, { widths: [320, 640] });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { master, variants } = result.image;
    const formats = new Set(variants.map((variant) => variant.format));
    for (const format of mediaProcessing.outputFormats) {
      expect(formats.has(format)).toBe(true);
    }

    const duplicates = variants.filter(
      (variant) => variant.format === master.format && variant.width === master.width,
    );
    expect(duplicates).toHaveLength(0);
    expect(result.image.totalBytes).toBe(
      master.bytes + variants.reduce((sum, variant) => sum + variant.bytes, 0),
    );
  });

  it('уменьшает вес производной вместе с шириной', async () => {
    const result = await processImage(await noiseImage(900, 600, 'jpeg'), {
      formats: ['webp'],
      widths: [320, 640],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const byWidth = [...result.image.variants].sort((a, b) => a.width - b.width);
    expect(byWidth.map((variant) => variant.width)).toEqual([320, 640]);
    expect(byWidth[0]!.bytes).toBeLessThan(byWidth[1]!.bytes);
    expect(byWidth[1]!.bytes).toBeLessThan(result.image.master.bytes);
  });

  it('отдаёт инлайновый blur-плейсхолдер разумного размера', async () => {
    const result = await processImage(await noiseImage(600, 400, 'jpeg'), {
      formats: ['webp'],
      masterOnly: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.image.blurDataUrl.startsWith('data:image/webp;base64,')).toBe(true);
    /** Плейсхолдер уезжает в HTML каждой страницы: килобайт здесь — это килобайт на документ. */
    expect(result.image.blurDataUrl.length).toBeLessThan(1_200);
  });

  it('передаёт отказ наружу без обработки', async () => {
    const result = await processImage(Buffer.from('not an image at all'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejection.code).toBe('MEDIA_UNREADABLE');
  });
});

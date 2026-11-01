/**
 * Генерация иконок бренда: PWA, favicon, apple touch, иконки мобильного приложения.
 *
 * Источник формы — буква «A» из логотипа (танцовщица): `design/brand/letter-a.svg`, вектор.
 * Буква вписывается в квадрат на бордовом фоне бренда. PNG рендерятся через sharp, растра нет.
 *
 * Запуск: `npx tsx scripts/generate-icons.ts`
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();

// Брендовые цвета из primitives.ts
const CRIMSON = '#8B1A2B';
const IVORY = '#F7F4EF';

interface IconOptions {
  maskable?: boolean;
  withRadius?: boolean;
  /** Бордовый квадрат под буквой; без него иконка прозрачная (переднего плана для Android). */
  background?: boolean;
  /** Буква; для фона Android без неё. */
  glyph?: boolean;
}

interface Glyph {
  viewBox: string;
  d: string;
}

/** Контур буквы из `design/brand/letter-a.svg`: viewBox и данные одного пути. */
function parseGlyph(svg: string): Glyph {
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  const d = svg.match(/ d="([^"]+)"/)?.[1];
  if (!viewBox || !d) throw new Error('letter-a.svg: нет viewBox или контура');
  return { viewBox, d };
}

function iconSvg(glyphShape: Glyph, size: number, opts: IconOptions = {}): string {
  const { maskable = false, withRadius = false, background = true, glyph = true } = opts;
  // Маскируемые иконки кладут букву в безопасную зону 80%, обычные — крупнее.
  const glyphSize = size * (maskable ? 0.5 : 0.62);
  const offset = (size - glyphSize) / 2;
  const radius = withRadius ? Math.round(size * 0.22) : 0;
  const rect = background ? `<rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${CRIMSON}" />` : '';
  const letter = glyph
    ? `<svg x="${offset}" y="${offset}" width="${glyphSize}" height="${glyphSize}" viewBox="${glyphShape.viewBox}" preserveAspectRatio="xMidYMid meet"><path fill="${IVORY}" fill-rule="evenodd" d="${glyphShape.d}" /></svg>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img">
  ${rect}
  ${letter}
</svg>`;
}

async function renderPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

function pngToIco(pngBuffers: Buffer[], sizes: number[]): Buffer {
  // ICO с PNG внутри (Vista+): заголовок, записи каталога, затем данные.
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(count, 4);
  let offset = headerSize;
  for (let i = 0; i < count; i++) {
    const png = pngBuffers[i]!;
    const size = sizes[i]!;
    const base = 6 + i * 16;
    header.writeUInt8(size === 256 ? 0 : size, base);
    header.writeUInt8(size === 256 ? 0 : size, base + 1);
    header.writeUInt8(0, base + 2);
    header.writeUInt8(0, base + 3);
    header.writeUInt16LE(1, base + 4);
    header.writeUInt16LE(32, base + 6);
    header.writeUInt32LE(png.length, base + 8);
    header.writeUInt32LE(offset, base + 12);
    offset += png.length;
  }
  return Buffer.concat([header, ...pngBuffers]);
}

async function main() {
  const glyphShape = parseGlyph(await readFile(join(ROOT, 'design', 'brand', 'letter-a.svg'), 'utf8'));

  const appDir = join(ROOT, 'src', 'app');
  // PWA-иконки не кладём в public: они уходят в R2 (media/app-icon-*.png), манифест читает их оттуда.
  const mediaDir = join(tmpdir(), 'artdance-icons');
  const mobileAssets = join(ROOT, 'mobile', 'assets');
  await mkdir(mediaDir, { recursive: true });

  // ——— PWA icons (в R2 под ключами media/app-icon-*.png) ———
  const pwa = [
    { size: 192, file: 'app-icon-192.png', maskable: false, radius: true },
    { size: 192, file: 'app-icon-192-maskable.png', maskable: true, radius: false },
    { size: 512, file: 'app-icon-512.png', maskable: false, radius: true },
    { size: 512, file: 'app-icon-512-maskable.png', maskable: true, radius: false },
  ] as const;
  for (const t of pwa) {
    const png = await renderPng(iconSvg(glyphShape, t.size, { maskable: t.maskable, withRadius: t.radius }));
    await writeFile(join(mediaDir, t.file), png);
    console.log(`✓ ${join(mediaDir, t.file)} (${png.length} bytes) — загрузить в R2 как media/${t.file}`);
  }

  // ——— favicon веба: 32px; app/icon.png отдаётся как /icon ———
  {
    const png = await renderPng(iconSvg(glyphShape, 32, { withRadius: true }));
    await writeFile(join(appDir, 'icon.png'), png);
    console.log(`✓ src/app/icon.png (${png.length} bytes)`);
  }

  // ——— Apple touch icon 180: без скруглений, iOS округляет сам. Тот же файл — аватар ассистента в R2 ———
  {
    const png = await renderPng(iconSvg(glyphShape, 180, { maskable: true, withRadius: false }));
    await writeFile(join(appDir, 'apple-icon.png'), png);
    console.log(`✓ src/app/apple-icon.png (${png.length} bytes)`);
  }

  // ——— favicon.ico: 16/32/48 PNG внутри ICO ———
  {
    const sizes = [16, 32, 48];
    const pngs: Buffer[] = [];
    for (const s of sizes) pngs.push(await renderPng(iconSvg(glyphShape, s)));
    const ico = pngToIco(pngs, sizes);
    await writeFile(join(appDir, 'favicon.ico'), ico);
    console.log(`✓ src/app/favicon.ico (${ico.length} bytes, ${sizes.join('/')}px)`);
  }

  // ——— Мобильное приложение (Expo): иконки в mobile/assets, см. mobile/app.json ———
  const mobile: Array<{ file: string; size: number; svg: string }> = [
    // Основная иконка: квадрат без скруглений (iOS и Android сами накладывают маску).
    { file: 'icon.png', size: 1024, svg: iconSvg(glyphShape, 1024) },
    // Android: фон отдельно, буква — передний план в безопасной зоне, монохром — тот же силуэт.
    { file: 'android-icon-background.png', size: 1024, svg: iconSvg(glyphShape, 1024, { background: true, glyph: false }) },
    { file: 'android-icon-foreground.png', size: 1024, svg: iconSvg(glyphShape, 1024, { maskable: true, background: false }) },
    { file: 'android-icon-monochrome.png', size: 1024, svg: iconSvg(glyphShape, 1024, { maskable: true, background: false }) },
    // Заставка: буква на прозрачном фоне, фон даёт экран заставки.
    { file: 'splash-icon.png', size: 1024, svg: iconSvg(glyphShape, 1024, { background: false }) },
    // Веб-версия Expo: favicon на бордовом фоне.
    { file: 'favicon.png', size: 48, svg: iconSvg(glyphShape, 48) },
  ];
  for (const t of mobile) {
    const png = await renderPng(t.svg);
    await writeFile(join(mobileAssets, t.file), png);
    console.log(`✓ mobile/assets/${t.file} (${png.length} bytes)`);
  }

  console.log('\nГотово. Проверь: npm run build должен показать ● /icon, ● /apple-icon, ● /manifest.webmanifest');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

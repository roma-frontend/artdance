/**
 * Генерация иконок бренда для PWA / favicon / apple touch.
 *
 * Источник формы — `src/components/brand/brand-mark.tsx` (силуэт танцовщицы).
 * Все PNG рендерятся из SVG через sharp, никаких внешних ассетов.
 *
 * Запуск: `npx tsx scripts/generate-icons.ts`
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();

// Брендовые цвета из primitives.ts
const CRIMSON = '#8B1A2B';
const IVORY = '#F7F4EF';

const BRAND_PATHS = `
  <circle cx="16" cy="6" r="3.2" fill="${IVORY}" />
  <path d="M16 10.5C16 10.5 9 13.8 7.5 21C6 28 11.5 29.5 14.5 28C17.5 26.5 16 22.5 16 22.5C16 22.5 14.5 26.5 17.5 28C20.5 29.5 26 28 24.5 21C23 13.8 16 10.5 16 10.5Z" fill="${IVORY}" />
  <path d="M11 15.5C11 15.5 8 12.5 5 14" stroke="${IVORY}" stroke-width="1.6" stroke-linecap="round" fill="none"/>
  <path d="M21 15.5C21 15.5 24 12.5 27 14" stroke="${IVORY}" stroke-width="1.6" stroke-linecap="round" fill="none"/>
`;

function iconSvg(size: number, opts: { maskable?: boolean; withRadius?: boolean } = {}): string {
  const { maskable = false, withRadius = false } = opts;
  // maskable — оставляем safe area 20% по кругу (icon внутри 80% центра)
  // поэтому фигура меньше и фон без скруглений (маску наложит система)
  const scaleFactor = maskable ? 0.46 : 0.58;
  const iconScale = (size * scaleFactor) / 32;
  const cx = size / 2;
  // визуальный центр чуть ниже геометрического — фигура вытянута вниз
  const cy = size / 2 + (maskable ? size * 0.015 : size * 0.02);
  const radius = withRadius ? Math.round(size * 0.22) : 0;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" role="img">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${CRIMSON}" />
  <g transform="translate(${cx}, ${cy}) scale(${iconScale}) translate(-16, -16)">
    ${BRAND_PATHS}
  </g>
</svg>`;
}

async function renderPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

function pngToIco(pngBuffers: Buffer[], sizes: number[]): Buffer {
  // ICO с PNG внутри (Vista+). Заголовок + записи + данные.
  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(count, 4);
  const parts: Buffer[] = [header];
  for (let i = 0; i < count; i++) {
    const png = pngBuffers[i]!;
    const size = sizes[i]!;
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // colors
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(png.length, 8); // bytes
    entry.writeUInt32LE(offset, 12); // offset
    // overwrite header entry
    entry.copy(header, 6 + i * 16);
    offset += png.length;
    parts.push(png);
  }
  // header already includes entries, but we pushed pngs separately — need to build final
  // Actually header buffer already contains entries, so we just concat header + pngs
  return Buffer.concat([header, ...pngBuffers]);
}

async function main() {
  const appDir = join(ROOT, 'src', 'app');
  const mediaDir = join(ROOT, 'public', 'media');

  await mkdir(mediaDir, { recursive: true });

  // ——— PWA icons ———
  const targets = [
    { size: 192, file: 'app-icon-192.png', maskable: false, radius: true },
    { size: 192, file: 'app-icon-192-maskable.png', maskable: true, radius: false },
    { size: 512, file: 'app-icon-512.png', maskable: false, radius: true },
    { size: 512, file: 'app-icon-512-maskable.png', maskable: true, radius: false },
  ] as const;

  for (const t of targets) {
    const svg = iconSvg(t.size, { maskable: t.maskable, withRadius: t.radius });
    const png = await renderPng(svg);
    await writeFile(join(mediaDir, t.file), png);
    console.log(`✓ public/media/${t.file} (${png.length} bytes)`);
  }

  // ——— app/icon.png (32) + high-res variants для /icon routes ———
  // Next file convention: icon.png → /icon , icon1.png → второй вариант и т.д.
  // Генерируем 32, 192, 512 как отдельные файлы для полноты.
  const appIcons = [
    { size: 32, file: 'icon.png', maskable: false, radius: true },
  ];
  for (const t of appIcons) {
    const svg = iconSvg(t.size, { maskable: t.maskable, withRadius: t.radius });
    const png = await renderPng(svg);
    await writeFile(join(appDir, t.file), png);
    console.log(`✓ src/app/${t.file} (${png.length} bytes)`);
  }

  // ——— Apple touch icon — 180×180, без скруглений (iOS округляет сам) ———
  {
    const size = 180;
    const svg = iconSvg(size, { maskable: true, withRadius: false });
    const png = await renderPng(svg);
    await writeFile(join(appDir, 'apple-icon.png'), png);
    console.log(`✓ src/app/apple-icon.png (${png.length} bytes)`);
  }

  // ——— Apple icon 180 maskable не нужен, но для консистентности оставляем 180 any ———
  // ——— favicon.ico — 16/32/48 PNG-in-ICO ———
  {
    const sizes = [16, 32, 48];
    const pngs: Buffer[] = [];
    for (const s of sizes) {
      const svg = iconSvg(s, { maskable: false, withRadius: false });
      // favicon — без скруглений, плотная фигура
      const png = await sharp(Buffer.from(svg)).png().toBuffer();
      pngs.push(png);
    }
    const ico = pngToIco(pngs, sizes);
    await writeFile(join(appDir, 'favicon.ico'), ico);
    console.log(`✓ src/app/favicon.ico (${ico.length} bytes, ${sizes.join('/')}px)`);
  }

  // public/favicon.ico не создаём — app/favicon.ico покрывает /favicon.ico

  console.log('\nГотово. Проверь: npm run build должен показать ● /icon, ● /apple-icon, ● /manifest.webmanifest');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

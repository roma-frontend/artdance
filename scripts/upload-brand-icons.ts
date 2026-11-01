/**
 * Загрузка иконок в R2: манифест PWA (`media/app-icon-*.png`) и иконка ассистента в приложении
 * (`brand/assistant-icon.png`). Файлы берутся из папки, куда пишет `scripts/generate-icons.ts`.
 *
 * Запуск (сначала `npx tsx scripts/generate-icons.ts`):
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/upload-brand-icons.ts
 *
 * Каждый объект после загрузки проверяется HEAD-запросом по публичному адресу R2.
 */

import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig({ path: '.env.local', override: false });
dotenvConfig({ path: '.env', override: false });
// Имя бакета проекта — в R2_BUCKET_NAME; до загрузки примера фиксируем его, иначе возьмётся заглушка.
if (!process.env.R2_BUCKET && process.env.R2_BUCKET_NAME) process.env.R2_BUCKET = process.env.R2_BUCKET_NAME;
// Публичные переменные нужны модулю конфигурации только для проверки формы.
dotenvConfig({ path: '.env.example', override: false });

// Импорт после загрузки переменных: модуль конфигурации проверяет их при загрузке.
const { putMediaObject, storageDriver } = await import('../src/lib/media/storage');

const dir = join(tmpdir(), 'artdance-icons');
const files: Array<{ key: string; path: string }> = [
  { key: 'media/app-icon-192.png', path: join(dir, 'app-icon-192.png') },
  { key: 'media/app-icon-192-maskable.png', path: join(dir, 'app-icon-192-maskable.png') },
  { key: 'media/app-icon-512.png', path: join(dir, 'app-icon-512.png') },
  { key: 'media/app-icon-512-maskable.png', path: join(dir, 'app-icon-512-maskable.png') },
  { key: 'brand/assistant-icon.png', path: join(dir, 'assistant-icon.png') },
];

async function main() {
  const publicBase = (process.env.R2_PUBLIC_BASE_URL?.trim() || process.env.R2_PUBLIC_URL?.trim() || process.env.NEXT_PUBLIC_MEDIA_CDN_URL?.trim() || '').replace(/\/$/, '');
  const driver = storageDriver();
  console.log(`driver=${driver} bucket=${process.env.R2_BUCKET} publicBase=${publicBase || '—'}`);
  if (driver !== 'r2' || !publicBase) throw new Error(`R2 is not configured (driver=${driver}).`);

  for (const { key, path } of files) {
    const data = await readFile(path);
    const result = await putMediaObject(key, data, 'image/png');
    console.log(`uploaded ${path} → ${key} (${result.bytes} bytes)`);

    const url = `${publicBase}/${key.split('/').map(encodeURIComponent).join('/')}`;
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HEAD failed for ${key}: ${res.status}`);
    const len = Number(res.headers.get('content-length'));
    if (len !== data.byteLength) throw new Error(`size mismatch for ${key}: local ${data.byteLength} vs remote ${len}`);
    console.log(`  verified ${res.status}, content-length ${len}`);
  }
  console.log('Icons uploaded and verified.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

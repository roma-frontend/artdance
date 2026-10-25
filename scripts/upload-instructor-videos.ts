/**
 * Загрузка видео инструкторов (превью по долгому нажатию) в R2.
 *
 *   node --conditions=react-server --env-file-if-exists=.env --env-file-if-exists=.env.local --import tsx scripts/upload-instructor-videos.ts [папка]
 *
 * Файл `<slug>-video.mp4` уходит в `media/instructor-peek/<slug>.mp4`. Каждый объект
 * проверяется HEAD-запросом по публичному адресу, затем дописывается в манифест.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig({ path: '.env.local', override: false });
dotenvConfig({ path: '.env', override: false });

import { getServerEnv } from '../src/config/env';
import { putMediaObject, storageDriver } from '../src/lib/media/storage';

const MANIFEST = 'design/media-r2-manifest.json';
const sourceDir = process.argv[2] ?? 'C:/Users/User/Downloads/video';

type ManifestEntry = { key: string; contentType: string; bytes: number; url: string };

async function main() {
  const env = getServerEnv();
  const publicBase = (env.resolvedR2PublicBaseUrl || env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (storageDriver() !== 'r2' || !publicBase) {
    throw new Error('Configure R2 credentials, bucket and public base URL first.');
  }

  const names = (await readdir(sourceDir)).filter((name) => name.endsWith('-video.mp4')).sort();
  if (!names.length) throw new Error(`No *-video.mp4 files in ${sourceDir}`);

  const uploaded: ManifestEntry[] = [];
  for (const name of names) {
    const slug = name.replace(/-video\.mp4$/, '');
    const key = `media/instructor-peek/${slug}.mp4`;
    const data = await readFile(join(sourceDir, name));

    await putMediaObject(key, data, 'video/mp4');

    const url = `${publicBase}/${key.split('/').map(encodeURIComponent).join('/')}`;
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(60_000) });
    if (!head.ok) throw new Error(`HEAD failed for ${key}: ${head.status} ${head.statusText}`);
    if (Number(head.headers.get('content-length')) !== data.byteLength) {
      throw new Error(`Size mismatch for ${key}: local ${data.byteLength}, remote ${head.headers.get('content-length')}`);
    }
    if (head.headers.get('content-type')?.split(';')[0] !== 'video/mp4') {
      throw new Error(`Unexpected content-type for ${key}: ${head.headers.get('content-type')}`);
    }

    uploaded.push({ key, contentType: 'video/mp4', bytes: data.byteLength, url });
    console.log(`${slug}  ${(data.byteLength / 1024 / 1024).toFixed(1)} MB  verified  ${url}`);
  }

  const recorded: ManifestEntry[] = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const byKey = new Map(recorded.map((entry) => [entry.key, entry]));
  for (const entry of uploaded) byKey.set(entry.key, entry);
  await writeFile(MANIFEST, `${JSON.stringify([...byKey.values()], null, 2)}\n`);

  console.log(`\nDone: ${uploaded.length} videos. Manifest: ${MANIFEST}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

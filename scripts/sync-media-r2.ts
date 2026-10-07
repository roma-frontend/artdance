import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { getServerEnv } from '../src/config/env';
import { putMediaObject, storageDriver } from '../src/lib/media/storage';

const contentTypes: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

async function main() {
  const env = getServerEnv();
  if (storageDriver() !== 'r2' || !env.R2_PUBLIC_BASE_URL) {
    throw new Error('Configure R2 credentials, R2_BUCKET and R2_PUBLIC_BASE_URL first.');
  }
  const checkOnly = process.argv.includes('--check');
  const manifestPath = 'design/media-r2-manifest.json';
  let files: { path?: string; key: string; contentType: string; bytes: number }[] = [];
  for (const [directory, prefix] of [
    ['public/media', 'media'],
    ['manual/generated-style-videos', 'originals/generated-style-videos'],
  ] as const) {
    const entries = await readdir(directory, { recursive: true }).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    for (const relative of entries) {
      const contentType = contentTypes[extname(relative).toLowerCase()];
      if (!contentType) continue;
      const path = join(directory, relative);
      files.push({
        path,
        key: `${prefix}/${relative.replaceAll('\\', '/')}`,
        contentType,
        bytes: (await stat(path)).size,
      });
    }
  }
  if (checkOnly) {
    const recorded = await readFile(manifestPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return '[]';
      throw error;
    });
    const inventory = new Map<string, (typeof files)[number]>();
    for (const file of JSON.parse(recorded) as typeof files) inventory.set(file.key, file);
    for (const file of files) inventory.set(file.key, file);
    files = [...inventory.values()];
  }
  if (!files.length) throw new Error('No local media or recorded R2 objects to verify.');

  let verified = 0;
  let bytes = 0;
  const pending = files.values();
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (const file of pending) {
      const size = file.bytes;
      if (!checkOnly) {
        await putMediaObject(file.key, await readFile(file.path!), file.contentType);
      }
      const url = `${env.R2_PUBLIC_BASE_URL!.replace(/\/$/, '')}/${file.key.split('/').map(encodeURIComponent).join('/')}`;
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(30_000) });
      if (!response.ok || Number(response.headers.get('content-length')) !== size
        || response.headers.get('content-type')?.split(';')[0] !== file.contentType) {
        throw new Error(`Public verification failed: ${file.key} (${response.status}).`);
      }
      verified += 1;
      bytes += size;
      console.log(`[${verified}/${files.length}] verified ${file.key}`);
    }
  }));
  const inventory = files.map(({ key, contentType, bytes }) => ({
    key,
    contentType,
    bytes,
    url: `${env.R2_PUBLIC_BASE_URL!.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`,
  }));
  await writeFile(manifestPath, `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(`Verified ${verified} objects, ${(bytes / 1024 / 1024).toFixed(1)} MiB. Inventory: ${manifestPath}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
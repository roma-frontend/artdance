import { readFile } from 'node:fs/promises';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local', override: false });
dotenvConfig({ path: '.env', override: false });

import { brandAssetKeys } from '../src/config/media';
import { getServerEnv } from '../src/config/env';
import { putMediaObject, storageDriver } from '../src/lib/media/storage';

async function main() {
  const env = getServerEnv();
  const bucket = (((env as Record<string, unknown>).resolvedR2Bucket as string | undefined) ?? env.R2_BUCKET ?? '') as string;
  const publicBase = (((env as Record<string, unknown>).resolvedR2PublicBaseUrl as string | undefined) ?? env.R2_PUBLIC_BASE_URL ?? '') as string;
  const driver = storageDriver();
  console.log(`driver=${driver} bucket=${bucket || '—'} publicBase=${publicBase || '—'}`);
  if (driver !== 'r2' || !publicBase) {
    throw new Error(`Configure R2 credentials, R2_BUCKET and R2_PUBLIC_BASE_URL first. (driver=${driver}, bucket=${bucket || '—'}, publicBase=${publicBase || '—'})`);
  }
  const effectivePublicBase = publicBase;

  const files: Array<{ key: string; path: string }> = [
    { key: brandAssetKeys.logo, path: 'public/logo.png' },
    { key: brandAssetKeys.logoOnDark, path: 'public/logo-on-dark.png' },
  ];

  for (const { key, path } of files) {
    const data = await readFile(path);
    const result = await putMediaObject(key, data, 'image/png');
    console.log(`uploaded ${path} → ${key} (${result.bytes} bytes) → ${result.url}`);

    const url = `${effectivePublicBase.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HEAD verification failed for ${key}: ${res.status} ${res.statusText}`);
    const len = Number(res.headers.get('content-length'));
    if (len !== data.byteLength) throw new Error(`size mismatch for ${key}: local ${data.byteLength} vs remote ${len}`);
    console.log(`  verified HEAD ${url} — ${res.status}, content-length ${len}`);
  }

  console.log('Brand logos uploaded and verified. You can now remove public/logo*.png locally (optional).');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

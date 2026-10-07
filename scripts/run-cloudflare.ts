import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd(), false);

const command = process.argv[2];
if (command !== 'preview' && command !== 'deploy') {
  throw new Error('Expected preview or deploy');
}

const result = spawnSync(
  process.execPath,
  [fileURLToPath(new URL('../node_modules/@opennextjs/cloudflare/dist/cli/index.js', import.meta.url)), command],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:
        process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ?? process.env.DATABASE_URL,
    },
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
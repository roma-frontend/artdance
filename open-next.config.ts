import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default {
  ...defineCloudflareConfig({
    // 430 SSG + 55 ƒ -> 1 worker
  }),
  buildCommand: 'npm run build -- --webpack',
} satisfies ReturnType<typeof defineCloudflareConfig>;

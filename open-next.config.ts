import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig({
  // 430 SSG + 55 ƒ -> 1 worker, обход лимита 12 функций на Vercel Hobby
  // Prisma 7 уже в сборе (prisma generate в build), Workers поддерживают Node fs
});

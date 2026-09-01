import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'prisma/**/*.test.ts'],
    // Тесты не должны зависеть от .env.local разработчика.
    env: {
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      NEXT_PUBLIC_APP_ENV: 'local',
      NEXT_PUBLIC_DEFAULT_LOCALE: 'hy',
      NEXT_PUBLIC_FEATURE_SHOP: 'true',
      NEXT_PUBLIC_FEATURE_COURSES: 'false',
      NEXT_PUBLIC_FEATURE_EVENTS: 'true',
      NEXT_PUBLIC_FEATURE_SUBSCRIPTIONS: 'true',
      NEXT_PUBLIC_FEATURE_VIDEO: 'false',
    },
  },
});

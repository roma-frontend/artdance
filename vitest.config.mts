import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      /*
       * `server-only` — маркер, который бросает при импорте вне серверного
       * окружения; в Next его подменяет условие экспорта `react-server`. Vitest
       * такого условия не ставит, поэтому подменяем сами — иначе модули
       * `src/server/**` в принципе нельзя покрыть тестами, а именно там живут
       * поиск, цены и правила бронирования.
       */
      'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
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
      /*
       * Серверные переменные тоже объявлены здесь, и это не про подключение к
       * базе. Модули `src/server/**` импортируют `src/lib/db.ts`, а тот создаёт
       * клиент Prisma при загрузке модуля — то есть требует `DATABASE_URL` даже
       * от теста, который в базу не ходит. Соединение не открывается, пока не
       * выполнится запрос, поэтому значение-заглушка достаточна.
       *
       * Без этих строк `npm run verify` проходил только у того, кто держит
       * переменные экспортированными в своей оболочке, а на чистой машине падал
       * тремя тестами — ровно то, от чего конфиг и должен защищать.
       */
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/artdance',
      AUTH_SECRET: 'vitest-only-secret-value-at-least-32-characters',
    },
  },
});

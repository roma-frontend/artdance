/**
 * Prisma 7 вынес строки подключения из `schema.prisma` в этот файл.
 *
 * Это удобно: URL миграций (прямое подключение) и URL приложения (через pooler)
 * теперь явно разделены, и схема больше не содержит ссылок на окружение.
 */

import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 больше не читает .env автоматически. Порядок важен:
// .env.local перекрывает .env, как в Next.js.
loadEnv({ path: ['.env.local', '.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',

  datasource: {
    // Миграции и introspection идут по прямому подключению: pooler не
    // поддерживает advisory locks, которые нужны Migrate.
    url: env('DIRECT_DATABASE_URL'),
  },

  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});

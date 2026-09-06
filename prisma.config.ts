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

/**
 * Миграции и introspection идут по прямому подключению: pooler не поддерживает
 * advisory locks, которые нужны Migrate.
 *
 * Прямое подключение — предпочтение, а не требование. `env()` разрешается жадно,
 * при загрузке этого файла, поэтому отсутствие DIRECT_DATABASE_URL валит даже
 * `prisma generate`, которому база вообще не нужна — а генерация теперь часть
 * сборки. Обязательна только DATABASE_URL (см. `src/config/env.ts`), значит
 * деплой с одной переменной должен собираться.
 */
const migrationUrlVariable = process.env.DIRECT_DATABASE_URL?.trim()
  ? 'DIRECT_DATABASE_URL'
  : 'DATABASE_URL';

export default defineConfig({
  schema: 'prisma/schema.prisma',

  datasource: {
    url: env(migrationUrlVariable),
  },

  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});

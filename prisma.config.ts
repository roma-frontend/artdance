/**
 * Prisma 7 вынес строки подключения из `schema.prisma` в этот файл.
 *
 * Это удобно: URL миграций (прямое подключение) и URL приложения (через pooler)
 * теперь явно разделены, и схема больше не содержит ссылок на окружение.
 */

import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7 больше не читает .env автоматически. Порядок важен:
// .env.local перекрывает .env, как в Next.js.
loadEnv({ path: ['.env.local', '.env'], quiet: true });

/**
 * Подключение нужно только командам миграций и introspection. `prisma generate`
 * обходится без него — но объявленный блок `datasource` разрешается ЖАДНО, при
 * загрузке этого файла, и делает переменную обязательной для ЛЮБОЙ команды
 * призмы. Генерация клиента входит в `npm run build` (клиент не хранится в
 * репозитории), а на хостинге переменных базы при сборке может не быть вовсе —
 * тогда деплой падал бы на `PrismaConfigEnvError`, ничего не пытаясь подключить.
 *
 * Поэтому блок появляется только тогда, когда URL действительно есть.
 *
 * Предпочтение — прямое подключение: pooler не поддерживает advisory locks,
 * которые нужны Migrate. Запасной вариант через `DATABASE_URL` рабочий ровно
 * настолько, насколько это подключение не через pooler.
 */
const migrationUrl = [process.env.DIRECT_DATABASE_URL, process.env.DATABASE_URL]
  .map((value) => value?.trim())
  .find((value) => Boolean(value));

export default defineConfig({
  schema: 'prisma/schema.prisma',

  ...(migrationUrl ? { datasource: { url: migrationUrl } } : {}),

  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
});

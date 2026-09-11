/**
 * Единственный экземпляр Prisma Client.
 *
 * Prisma 7 требует driver adapter — подключение больше не описывается в схеме.
 * Это удобно: приложение ходит через pooler (`DATABASE_URL`), а миграции — по
 * прямому подключению (`DIRECT_DATABASE_URL`, см. `prisma.config.ts`).
 *
 * В dev клиент кешируется на globalThis, иначе hot reload открывает новый пул
 * соединений на каждое изменение файла и упирается в лимит Supabase.
 *
 * КОРЗИНА. Клиент расширен так, что удалённые записи не видны НИ ОДНОМУ чтению.
 * Это не удобство, а единственный способ не ошибиться: фильтр `deletedAt: null`,
 * расставленный руками по семнадцати файлам, однажды забудут в одном запросе — и
 * удалённое занятие останется в каталоге и останется бронируемым, причём тихо.
 * Правило подмешивания — `readArgsWithoutTrashed`, оно вынесено в домен и покрыто
 * тестами.
 *
 * Чего расширение НЕ покрывает: вложенные чтения (`select: { media: … }`) —
 * ограничение Prisma, расширения запросов до них не доходят. Для связей фильтр
 * объявлен в `src/server/queries/relations.ts`, и его наличие проверяет тест.
 */

import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';

import { getServerEnv, isProduction } from '@/config/env';
import { readArgsWithoutTrashed } from '@/domain/trash';
import { PrismaClient } from '@/generated/prisma/client';

function createBaseClient(): PrismaClient {
  const env = getServerEnv();
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log: isProduction ? ['error', 'warn'] : ['query', 'error', 'warn'],
  });
}

/**
 * На `globalThis` кешируется БАЗОВЫЙ клиент, а не расширенный.
 *
 * Кеш нужен ради пула соединений: hot reload переоценивает модуль на каждое
 * изменение файла, и новый клиент на каждую правку упирается в лимит соединений.
 * Но кешировать расширенный клиент нельзя — правка самого расширения тогда не
 * применяется до перезапуска сервера, и это выглядит как «фильтр не работает».
 * Поймано на практике: удалённое занятие осталось в каталоге, хотя запрос уже
 * был правильным.
 *
 * Расширения дёшевы: они не открывают соединений, поэтому применяются заново при
 * каждой переоценке модуля.
 */
const globalForPrisma = globalThis as unknown as { prismaBase?: PrismaClient };

const base = globalForPrisma.prismaBase ?? createBaseClient();

if (!isProduction) globalForPrisma.prismaBase = base;

function extend(client: PrismaClient) {
  return client.$extends({
    name: 'hideTrashed',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          return query(readArgsWithoutTrashed(model, operation, args) as typeof args);
        },
      },
    },
  });
}

export type Db = ReturnType<typeof extend>;

export const db: Db = extend(base);

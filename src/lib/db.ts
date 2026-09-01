/**
 * Единственный экземпляр Prisma Client.
 *
 * Prisma 7 требует driver adapter — подключение больше не описывается в схеме.
 * Это удобно: приложение ходит через pooler (`DATABASE_URL`), а миграции — по
 * прямому подключению (`DIRECT_DATABASE_URL`, см. `prisma.config.ts`).
 *
 * В dev клиент кешируется на globalThis, иначе hot reload открывает новый пул
 * соединений на каждое изменение файла и упирается в лимит Supabase.
 */

import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';

import { getServerEnv, isProduction } from '@/config/env';
import { PrismaClient } from '@/generated/prisma/client';

function createPrismaClient(): PrismaClient {
  const env = getServerEnv();
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log: isProduction ? ['error', 'warn'] : ['query', 'error', 'warn'],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) globalForPrisma.prisma = db;

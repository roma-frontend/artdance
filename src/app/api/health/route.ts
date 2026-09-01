/**
 * Health check для балансировщика и внешнего мониторинга.
 *
 * Два уровня, потому что они отвечают на разные вопросы:
 *   • `GET /api/health` — «процесс жив» (liveness). Не трогает БД: если проверка
 *     живости зависит от базы, кратковременный сбой БД приводит к перезапуску
 *     всех инстансов и превращает деградацию в полный отказ.
 *   • `GET /api/health?deep=1` — «зависимости доступны» (readiness). Проверяет БД
 *     с коротким таймаутом.
 *
 * Ответ никогда не кешируется и не раскрывает версий библиотек и путей.
 */

import { NextResponse } from 'next/server';

import { clientEnv } from '@/config/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEEP_CHECK_TIMEOUT_MS = 2_000;

function noStore(body: object, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const startedAt = Date.now();
  try {
    const { db } = await import('@/lib/db');
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), DEEP_CHECK_TIMEOUT_MS),
      ),
    ]);
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'unknown',
    };
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const deep = new URL(request.url).searchParams.get('deep') === '1';

  const base = {
    status: 'ok' as 'ok' | 'degraded',
    environment: clientEnv.NEXT_PUBLIC_APP_ENV,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  };

  if (!deep) return noStore(base);

  const database = await checkDatabase();
  const status = database.ok ? 'ok' : 'degraded';

  return noStore({ ...base, status, checks: { database } }, database.ok ? 200 : 503);
}

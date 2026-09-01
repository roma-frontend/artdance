/**
 * RATE LIMITING — фиксированное окно на Redis, с деградацией.
 *
 * Три решения, перенятые из `office` и `builder-studio`, каждое из которых
 * исправляет конкретную ошибку:
 *
 * 1. **Fail closed в production.** Если Redis недоступен, запрос отклоняется, а
 *    не пропускается. Иначе падение Redis автоматически снимает всю защиту от
 *    брутфорса — то есть отказ инфраструктуры превращается в дыру.
 * 2. **Fail open в разработке.** Локально Redis не нужен, иначе никто не
 *    запустит проект.
 * 3. **Правила по логической операции, а не по URL** — лимиты берутся из
 *    `rateLimits` в `@/config/business` и выживают рефакторинг роутов.
 *
 * Реализация на голом `fetch` к Upstash REST API: работает и в Node, и в Edge
 * (нужно для `proxy.ts`), не тянет SDK в бандл.
 *
 * In-memory-фолбэк честно ограничен одним инстансом. Он предназначен только для
 * разработки и как backstop от флуда; на защиту от распределённой атаки
 * не рассчитан.
 */

import { rateLimits, type RateLimitKey } from '@/config/business';
import { isProduction } from '@/config/env';

export interface RateLimitResult {
  allowed: boolean;
  /** Сколько запросов осталось в текущем окне. */
  remaining: number;
  /** Когда окно сбросится (мс, epoch). */
  resetAt: number;
  /** Сколько секунд ждать — для заголовка `Retry-After`. */
  retryAfterSeconds: number;
  /** Источник решения: полезно в логах при разборе инцидентов. */
  backend: 'redis' | 'memory' | 'fail-closed';
}

interface RedisConfig {
  url: string;
  token: string;
}

/**
 * Конфигурация читается из `process.env` напрямую, а не через `getServerEnv()`:
 * этот модуль вызывается из `proxy.ts`, работающего в Edge-рантайме, где Zod-схема
 * серверного окружения недоступна. Обе переменные необязательны — отсутствие
 * означает работу без Redis.
 */
function redisConfig(): RedisConfig | null {
  const url = process.env.RATE_LIMIT_REDIS_URL;
  const token = process.env.RATE_LIMIT_REDIS_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

/* ─────────────────────────── In-memory backstop ─────────────────────────── */

interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();
const MEMORY_MAX_KEYS = 50_000;

function pruneMemory(now: number): void {
  for (const [key, entry] of memoryStore) {
    if (entry.resetAt <= now) memoryStore.delete(key);
  }
  /** Аварийный сброс: защита от неограниченного роста памяти при атаке. */
  if (memoryStore.size > MEMORY_MAX_KEYS) memoryStore.clear();
}

function memoryLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (memoryStore.size > 1_000) pruneMemory(now);

  const existing = memoryStore.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: max - 1,
      resetAt,
      retryAfterSeconds: 0,
      backend: 'memory',
    };
  }

  existing.count += 1;
  const allowed = existing.count <= max;
  return {
    allowed,
    remaining: Math.max(0, max - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1_000),
    backend: 'memory',
  };
}

/* ─────────────────────────────── Redis ─────────────────────────────── */

/**
 * Фиксированное окно: ключ содержит номер окна, поэтому истечение TTL само
 * сбрасывает счётчик. `EXPIRE ... NX` ставит TTL только при создании ключа —
 * иначе окно продлевалось бы на каждом запросе и превращалось в бесконечное.
 */
async function redisLimit(
  config: RedisConfig,
  key: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const now = Date.now();
  const windowIndex = Math.floor(now / windowMs);
  const resetAt = (windowIndex + 1) * windowMs;
  const windowSeconds = Math.ceil(windowMs / 1_000);
  const redisKey = `rl:${key}:${windowIndex}`;

  try {
    const response = await fetch(`${config.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['EXPIRE', redisKey, String(windowSeconds), 'NX'],
      ]),
      /** Лимитер не должен становиться источником задержки. */
      signal: AbortSignal.timeout(1_500),
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as Array<{ result?: unknown; error?: string }>;
    const incr = payload[0];
    if (!incr || incr.error !== undefined) return null;

    const count = Number(incr.result);
    if (!Number.isFinite(count)) return null;

    const allowed = count <= max;
    return {
      allowed,
      remaining: Math.max(0, max - count),
      resetAt,
      retryAfterSeconds: allowed ? 0 : Math.ceil((resetAt - now) / 1_000),
      backend: 'redis',
    };
  } catch {
    return null;
  }
}

/* ─────────────────────────────── API ─────────────────────────────── */

/**
 * Проверяет лимит для именованной операции.
 *
 *   const result = await checkRateLimit('signIn', ip);
 *   if (!result.allowed) throw domainErrors.rateLimited(result.retryAfterSeconds);
 *
 * @param operation ключ из `rateLimits` в `@/config/business`
 * @param identifier IP, id пользователя или их комбинация
 */
export async function checkRateLimit(
  operation: RateLimitKey,
  identifier: string,
): Promise<RateLimitResult> {
  const rule = rateLimits[operation];
  const windowMs = rule.windowSeconds * 1_000;
  const key = `${operation}:${identifier}`;

  const config = redisConfig();
  if (config) {
    const result = await redisLimit(config, key, rule.requests, windowMs);
    if (result) return result;
  }

  /**
   * Redis не настроен или недоступен. В production это означает отказ: лучше
   * отклонить запрос, чем остаться без защиты от брутфорса.
   */
  if (isProduction) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + windowMs,
      retryAfterSeconds: rule.windowSeconds,
      backend: 'fail-closed',
    };
  }

  return memoryLimit(key, rule.requests, windowMs);
}

/**
 * Грубый backstop от флуда для всего `/api`. Вызывается из `proxy.ts`, где
 * ещё неизвестно, какая именно операция запрошена.
 */
export async function checkApiFloodLimit(identifier: string): Promise<RateLimitResult> {
  const rule = rateLimits.apiFlood;
  const windowMs = rule.windowSeconds * 1_000;
  const key = `apiFlood:${identifier}`;

  const config = redisConfig();
  if (config) {
    const result = await redisLimit(config, key, rule.requests, windowMs);
    if (result) return result;
  }

  /**
   * Флуд-backstop намеренно fail-open даже в production: он защищает от шума, а
   * не от целевой атаки, и его отказ не должен ронять весь сайт. Точечные лимиты
   * на логин и платежи остаются fail-closed.
   */
  return memoryLimit(key, rule.requests, windowMs);
}

/** Заголовки ответа 429. Клиент обязан узнать, когда можно повторить. */
export function rateLimitHeaders(result: RateLimitResult, operation: RateLimitKey): Record<string, string> {
  return {
    'Retry-After': String(result.retryAfterSeconds),
    'X-RateLimit-Limit': String(rateLimits[operation].requests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1_000)),
  };
}

/**
 * IP клиента. За CDN реальный адрес приходит в заголовках, а `request.ip`
 * отсутствует. User-Agent в ключ НЕ включается: он подделывается одной строкой,
 * и его добавление лишь дробит бакеты, ослабляя лимит.
 */
export function clientIdentifier(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? 'unknown';
}

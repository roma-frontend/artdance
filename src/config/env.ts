/**
 * ENVIRONMENT — единственная легальная точка чтения `process.env`.
 *
 * Правила (проверяются ESLint-правилом `no-restricted-properties`):
 *  • Нигде в `src/**`, кроме этого файла, `process.env` не используется.
 *  • Схема валидируется при загрузке модуля → битый деплой падает на старте,
 *    а не в рантайме на клиентском платеже.
 *  • Серверные секреты физически недоступны в клиентском бандле: они лежат
 *    в `serverEnv`, который импортируется только из server-only модулей.
 */

import { z } from 'zod';

const nodeEnv = z.enum(['development', 'test', 'production']);

/** Пустая строка из .env трактуется как «не задано». */
const optionalString = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().min(1).optional(),
);

const requiredString = z.string().min(1);
const boolFlag = z
  .preprocess((v) => (v === undefined ? undefined : String(v).toLowerCase()), z.enum(['true', 'false']).optional())
  .transform((v) => v === 'true');

/* ──────────────────────────── CLIENT ──────────────────────────── */

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_APP_ENV: z.enum(['local', 'preview', 'staging', 'production']),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['hy', 'ru', 'en']),
  NEXT_PUBLIC_SENTRY_DSN: optionalString,
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: optionalString,
  NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR: optionalString,
  NEXT_PUBLIC_POSTHOG_KEY: optionalString,
  NEXT_PUBLIC_POSTHOG_HOST: z.url().optional(),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: optionalString,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalString,
  NEXT_PUBLIC_MAPS_API_KEY: optionalString,
  NEXT_PUBLIC_MEDIA_CDN_URL: z.url().optional(),
  /** Runtime-переключатели, которые обязаны быть видны клиенту. */
  NEXT_PUBLIC_FEATURE_SHOP: boolFlag,
  NEXT_PUBLIC_FEATURE_COURSES: boolFlag,
  NEXT_PUBLIC_FEATURE_EVENTS: boolFlag,
  NEXT_PUBLIC_FEATURE_SUBSCRIPTIONS: boolFlag,
  NEXT_PUBLIC_FEATURE_VIDEO: boolFlag,
});

/**
 * Обращения к `process.env.NEXT_PUBLIC_*` должны быть статическими литералами —
 * иначе Next не подставит значения при сборке.
 */
const rawClientEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR: process.env.NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NEXT_PUBLIC_MAPS_API_KEY: process.env.NEXT_PUBLIC_MAPS_API_KEY,
  NEXT_PUBLIC_MEDIA_CDN_URL: process.env.NEXT_PUBLIC_MEDIA_CDN_URL,
  NEXT_PUBLIC_FEATURE_SHOP: process.env.NEXT_PUBLIC_FEATURE_SHOP,
  NEXT_PUBLIC_FEATURE_COURSES: process.env.NEXT_PUBLIC_FEATURE_COURSES,
  NEXT_PUBLIC_FEATURE_EVENTS: process.env.NEXT_PUBLIC_FEATURE_EVENTS,
  NEXT_PUBLIC_FEATURE_SUBSCRIPTIONS: process.env.NEXT_PUBLIC_FEATURE_SUBSCRIPTIONS,
  NEXT_PUBLIC_FEATURE_VIDEO: process.env.NEXT_PUBLIC_FEATURE_VIDEO,
} as const;

/* ──────────────────────────── SERVER ──────────────────────────── */

const serverSchema = z.object({
  NODE_ENV: nodeEnv.default('development'),

  /* База данных */
  DATABASE_URL: requiredString,
  DIRECT_DATABASE_URL: optionalString,

  /* Аутентификация */
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET должен быть длиной ≥32 символов'),
  AUTH_TRUSTED_ORIGINS: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,

  /* Платежи — активный провайдер выбирается здесь, код от него не зависит */
  PAYMENT_PROVIDER: z.enum(['paynet', 'arca-epg', 'ameria-vpos', 'idram', 'mock']).default('mock'),
  PAYMENT_RETURN_PATH: z.string().startsWith('/').default('/checkout/result'),
  PAYNET_API_URL: z.url().optional(),
  PAYNET_MERCHANT_ID: optionalString,
  PAYNET_API_KEY: optionalString,
  PAYNET_WEBHOOK_SECRET: optionalString,
  ARCA_EPG_API_URL: z.url().optional(),
  ARCA_EPG_USERNAME: optionalString,
  ARCA_EPG_PASSWORD: optionalString,
  AMERIA_VPOS_API_URL: z.url().optional(),
  AMERIA_VPOS_CLIENT_ID: optionalString,
  AMERIA_VPOS_USERNAME: optionalString,
  AMERIA_VPOS_PASSWORD: optionalString,
  IDRAM_MERCHANT_ID: optionalString,
  IDRAM_SECRET_KEY: optionalString,

  /* Медиа */
  R2_ACCOUNT_ID: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET: optionalString,
  R2_PUBLIC_BASE_URL: z.url().optional(),

  /* Уведомления */
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_REPLY_TO: z.string().email().optional(),
  SMS_PROVIDER: z.enum(['twilio', 'local-aggregator', 'mock']).default('mock'),
  SMS_API_KEY: optionalString,
  SMS_API_SECRET: optionalString,
  SMS_SENDER_ID: optionalString,

  /* Безопасность и наблюдаемость */
  TURNSTILE_SECRET_KEY: optionalString,
  SENTRY_AUTH_TOKEN: optionalString,
  SENTRY_TRACES_SAMPLE_RATE: optionalString,
  /** Upstash Redis REST. Обе переменные нужны вместе, иначе лимиты — in-memory. */
  RATE_LIMIT_REDIS_URL: optionalString,
  RATE_LIMIT_REDIS_TOKEN: optionalString,
  CRON_SECRET: optionalString,

  /* Внешние сервисы */
  MAPS_SERVER_API_KEY: optionalString,
  EXCHANGE_RATE_API_URL: z.url().optional(),
});

/* ──────────────────────────── PARSE ──────────────────────────── */

function fail(label: string, error: z.ZodError): never {
  const lines = error.issues.map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`);
  throw new Error(`[env] Некорректная конфигурация ${label}:\n${lines.join('\n')}`);
}

const clientParsed = clientSchema.safeParse(rawClientEnv);
if (!clientParsed.success) fail('клиента', clientParsed.error);

export const clientEnv = clientParsed.data;
export type ClientEnv = typeof clientEnv;

const IS_BROWSER = typeof window !== 'undefined';

/**
 * Серверный env. Ленивый парсинг: на клиенте обращение бросает исключение,
 * что превращает случайный импорт секрета в ошибку разработки, а не в утечку.
 */
let serverEnvCache: z.infer<typeof serverSchema> | null = null;

export function getServerEnv(): z.infer<typeof serverSchema> {
  if (IS_BROWSER) {
    throw new Error('[env] getServerEnv() вызван на клиенте. Секреты недоступны в браузере.');
  }
  if (serverEnvCache) return serverEnvCache;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) fail('сервера', parsed.error);
  serverEnvCache = parsed.data;
  return serverEnvCache;
}

export type ServerEnv = z.infer<typeof serverSchema>;

export const isProduction = clientEnv.NEXT_PUBLIC_APP_ENV === 'production';
export const isPreview = clientEnv.NEXT_PUBLIC_APP_ENV === 'preview';
export const isLocal = clientEnv.NEXT_PUBLIC_APP_ENV === 'local';

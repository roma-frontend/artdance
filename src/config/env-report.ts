/**
 * Диагностика конфигурации на старте.
 *
 * `env.ts` падает на обязательных переменных — это правильно: битый деплой должен
 * упасть при запуске, а не на платеже клиента. Но у необязательных интеграций
 * есть другая, более коварная проблema: **частично настроенная интеграция тихо
 * не работает**. Три из четырёх переменных R2 заданы — загрузка файлов молча
 * падает в рантайме, и никто не понимает почему.
 *
 * Этот модуль проверяет группы переменных по принципу «всё или ничего» и печатает
 * отчёт при старте. Он ничего не бросает: приложение обязано подниматься с
 * пустым `.env.local` и деградировать предсказуемо.
 *
 * Функция `checkEnvironment` чистая (окружение инжектится) — покрывается тестами.
 */

type Level = 'error' | 'warn' | 'info';

export interface EnvIssue {
  level: Level;
  group: string;
  message: string;
}

interface Group {
  name: string;
  keys: readonly string[];
  /** Что перестаёт работать без этой группы. */
  degradesTo: string;
  /** `error` — группа настроена частично; `warn` — не настроена вовсе. */
  requiredInProduction: boolean;
}

const GROUPS: readonly Group[] = [
  {
    name: 'R2',
    keys: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL'],
    degradesTo: 'загрузка фото инструкторов, площадок и товаров недоступна',
    requiredInProduction: true,
  },
  {
    name: 'EMAIL',
    keys: ['RESEND_API_KEY', 'EMAIL_FROM'],
    degradesTo: 'письма подтверждения брони и заказа не отправляются',
    requiredInProduction: true,
  },
  {
    name: 'TURNSTILE',
    keys: ['NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'],
    degradesTo: 'формы не защищены от ботов',
    requiredInProduction: true,
  },
  {
    name: 'RATE_LIMIT',
    keys: ['RATE_LIMIT_REDIS_URL', 'RATE_LIMIT_REDIS_TOKEN'],
    degradesTo: 'лимиты работают только в памяти одного инстанса; в production запросы будут отклоняться',
    requiredInProduction: true,
  },
  {
    name: 'SENTRY',
    keys: ['NEXT_PUBLIC_SENTRY_DSN'],
    degradesTo: 'ошибки в production видны только в логах платформы',
    requiredInProduction: true,
  },
  {
    name: 'MAPS',
    keys: ['NEXT_PUBLIC_MAPS_API_KEY'],
    degradesTo: 'карта площадок не отображается',
    requiredInProduction: false,
  },
  {
    name: 'SMS',
    keys: ['SMS_API_KEY', 'SMS_SENDER_ID'],
    degradesTo: 'SMS-напоминания и OTP не отправляются',
    requiredInProduction: false,
  },
  {
    name: 'GOOGLE_OAUTH',
    keys: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    degradesTo: 'вход через Google недоступен',
    requiredInProduction: false,
  },
  {
    name: 'CRON',
    keys: ['CRON_SECRET'],
    degradesTo: 'cron-эндпоинты доступны без аутентификации',
    requiredInProduction: true,
  },
];

/** Провайдер платежей: соответствие выбранного провайдера и его переменных. */
const PROVIDER_KEYS: Record<string, readonly string[]> = {
  paynet: ['PAYNET_API_URL', 'PAYNET_MERCHANT_ID', 'PAYNET_API_KEY', 'PAYNET_WEBHOOK_SECRET'],
  'arca-epg': ['ARCA_EPG_API_URL', 'ARCA_EPG_USERNAME', 'ARCA_EPG_PASSWORD'],
  'ameria-vpos': [
    'AMERIA_VPOS_API_URL',
    'AMERIA_VPOS_CLIENT_ID',
    'AMERIA_VPOS_USERNAME',
    'AMERIA_VPOS_PASSWORD',
  ],
  idram: ['IDRAM_MERCHANT_ID', 'IDRAM_SECRET_KEY'],
  mock: [],
};

export function checkEnvironment(env: Record<string, string | undefined>): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const isProduction = env.NEXT_PUBLIC_APP_ENV === 'production';
  const has = (key: string): boolean => Boolean(env[key]?.trim());

  for (const group of GROUPS) {
    const present = group.keys.filter(has);

    if (present.length > 0 && present.length < group.keys.length) {
      issues.push({
        level: 'error',
        group: group.name,
        message: `настроена частично — не заданы: ${group.keys.filter((k) => !has(k)).join(', ')}. ${group.degradesTo}`,
      });
      continue;
    }

    if (present.length === 0) {
      issues.push({
        level: isProduction && group.requiredInProduction ? 'error' : 'warn',
        group: group.name,
        message: `не настроена — ${group.degradesTo}`,
      });
    }
  }

  /** Провайдер платежей выбран, но его реквизиты отсутствуют. */
  const provider = env.PAYMENT_PROVIDER ?? 'mock';
  const providerKeys = PROVIDER_KEYS[provider];
  if (providerKeys === undefined) {
    issues.push({ level: 'error', group: 'PAYMENTS', message: `неизвестный PAYMENT_PROVIDER: ${provider}` });
  } else {
    const missing = providerKeys.filter((k) => !has(k));
    if (missing.length > 0) {
      issues.push({
        level: 'error',
        group: 'PAYMENTS',
        message: `PAYMENT_PROVIDER=${provider}, но не заданы: ${missing.join(', ')}`,
      });
    }
  }

  if (isProduction && provider === 'mock') {
    issues.push({
      level: 'error',
      group: 'PAYMENTS',
      message: 'в production выбран mock-провайдер: платежи не проводятся',
    });
  }

  /** Прямое подключение к БД нужно миграциям: pooler не поддерживает advisory locks. */
  if (has('DATABASE_URL') && !has('DIRECT_DATABASE_URL')) {
    issues.push({
      level: 'warn',
      group: 'DATABASE',
      message: 'DIRECT_DATABASE_URL не задан — миграции через pooler могут зависать',
    });
  }

  return issues;
}

/** Печатает отчёт. Ничего не бросает: диагностика не должна ронять старт. */
export function reportEnvironmentIssues(): void {
  const issues = checkEnvironment(process.env as Record<string, string | undefined>);
  if (issues.length === 0) {
    console.log('[env] конфигурация полная');
    return;
  }

  for (const issue of issues) {
    const line = `[env:${issue.level}] ${issue.group}: ${issue.message}`;
    if (issue.level === 'error') console.error(line);
    else console.warn(line);
  }
}

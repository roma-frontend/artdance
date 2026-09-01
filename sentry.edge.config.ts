/**
 * Sentry, Edge-рантайм (proxy). Набор интеграций здесь ограничен: в Edge нет
 * доступа к Node API, поэтому конфигурация минимальна.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  sendDefaultPii: false,
});

/**
 * Sentry, серверный рантайм. Инициализируется только при заданном DSN —
 * см. `instrumentation.ts`.
 *
 * Sample rate вынесен в переменные окружения: на старте нужен 100%, при росте
 * трафика — доли процента, и менять это деплоем кода неправильно.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  /** Отправка PII отключена: адреса и телефоны клиентов не должны уезжать в трекер. */
  sendDefaultPii: false,
  ignoreErrors: [
    /** Ожидаемые бизнес-отказы не являются инцидентами. */
    'RATE_LIMITED',
    'CROSS_ORIGIN_REJECTED',
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
  ],
  beforeSend(event) {
    /** Cookie и Authorization вырезаются до отправки. */
    if (event.request?.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.authorization;
    }
    return event;
  },
});

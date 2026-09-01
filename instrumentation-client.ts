/**
 * Клиентская инициализация Sentry.
 *
 * Импорт **динамический** намеренно: статический затягивает ~350 KB SDK в
 * начальный бандл каждой страницы, включая публичный каталог. Это ухудшает LCP
 * ради инструмента, который не нужен до первой ошибки. Динамический импорт
 * выносит SDK в отдельный чанк и грузит его после гидратации.
 *
 * Без DSN не загружается вообще — локальная разработка не отправляет ничего.
 */

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import('@sentry/nextjs').then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_APP_ENV,
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      /** Session replay стоит денег и содержит PII — включается осознанно. */
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR ?? '0'),
      sendDefaultPii: false,
    });
  });
}

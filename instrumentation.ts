/**
 * Единая точка startup-хуков Next.js.
 *
 * Импорты динамические и разведены по рантаймам: Node-only зависимости
 * (OpenTelemetry, Prisma, Sentry Node SDK) не должны попадать в Edge-бандл —
 * иначе proxy перестаёт собираться с невнятной ошибкой про `node:fs`.
 *
 * Каждая интеграция под env-гейтом: приложение обязано подниматься с пустым
 * `.env.local`, иначе новый разработчик не запустит проект.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      await import('./sentry.server.config');
    }
    /** Раннее предупреждение о неполной конфигурации — до первого запроса. */
    const { reportEnvironmentIssues } = await import('./src/config/env-report');
    reportEnvironmentIssues();
  }

  if (process.env.NEXT_RUNTIME === 'edge' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    await import('./sentry.edge.config');
  }
}

/**
 * Ловит ошибки во вложенных серверных компонентах и route handlers, которые
 * не доходят до `error.tsx`. Без этого хука половина серверных исключений
 * остаётся только в логах платформы.
 */
export async function onRequestError(...args: unknown[]): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  // @ts-expect-error — сигнатура Next не типизирована публично
  return Sentry.captureRequestError(...args);
}

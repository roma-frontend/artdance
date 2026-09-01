'use client';

/**
 * Последний рубеж: сработал сбой в корневом layout, поэтому этот компонент
 * обязан отрендерить собственные `<html>` и `<body>`.
 *
 * Три следствия, которые легко упустить:
 *   1. **Все стили — инлайновые.** Tailwind-цепочка могла не загрузиться, и
 *      классы не применятся.
 *   2. **Текст не берётся из i18n.** Провайдер переводов недоступен — здесь
 *      единственное место в проекте, где строки допустимы в разметке. Показываем
 *      три языка сразу, чтобы пользователь понял сообщение.
 *   3. **Ссылка — обычный `<a>`, а не `Link`.** Роутер в этот момент сломан,
 *      нужна полная перезагрузка.
 *
 * `error.digest` выводится намеренно: это единственный способ сопоставить экран
 * пользователя с записью в логах.
 */

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error));
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F7F4EF',
          color: '#141414',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '2rem',
        }}
      >
        <main style={{ maxWidth: '32rem', textAlign: 'center' }}>
          <p
            style={{
              fontSize: '0.6875rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#8B1A2B',
              marginBottom: '1rem',
            }}
          >
            ArtDance
          </p>
          <h1 style={{ fontSize: '1.75rem', lineHeight: 1.15, margin: '0 0 1rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#6B645C', lineHeight: 1.6, margin: '0 0 0.5rem' }}>
            Ինչ-որ բան սխալ գնաց։ Փորձեք կրկին։
          </p>
          <p style={{ color: '#6B645C', lineHeight: 1.6, margin: '0 0 2rem' }}>
            Что-то пошло не так. Попробуйте ещё раз.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: '0.75rem 1.75rem',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: '#8B1A2B',
                color: '#FFFFFF',
                fontSize: '0.8125rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: '0.75rem 1.75rem',
                borderRadius: '999px',
                border: '1.5px solid #E8E2DA',
                color: '#141414',
                fontSize: '0.8125rem',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              Home
            </a>
          </div>

          {error.digest && (
            <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#A9A199' }}>
              Reference: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}

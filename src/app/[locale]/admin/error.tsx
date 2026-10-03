'use client';

/**
 * ERROR BOUNDARY админки — A-10: 4 состояния каждого экрана.
 *
 * `loading.tsx` и `error.tsx` на сегменте `[locale]/admin` дают два из четырёх
 * состояний (см. 05-screen-inventory, 10-polish-and-quality §7): загрузку и
 * ошибку. Остальные два — `empty` (EmptyState в списках) и `denied`
 * (AccessDenied по capability) — рендерятся внутри страниц.
 *
 * Граница ловит вылет рендера сегмента (Prisma, парсинг ContentBlock, правка).
 * `digest` выводится без PII и уходит в Sentry.
 */

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { clientEnv } from '@/config/env';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors.generic');

  useEffect(() => {
    if (clientEnv.NEXT_PUBLIC_SENTRY_DSN) {
      void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error));
    }
  }, [error]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-center justify-center gap-4 rounded-xl border border-danger/20 bg-danger-soft px-6 py-16 text-center"
    >
      <h1 className="text-card-title text-content-primary">{t('title')}</h1>
      <p className="text-body-sm max-w-(--layout-prose-max-width) text-content-secondary">{t('description')}</p>
      <Button variant="outline" onClick={reset}>
        {t('cta')}
      </Button>
      {error.digest !== undefined ? (
        <p className="text-caption font-mono text-content-tertiary">ID: {error.digest}</p>
      ) : null}
    </div>
  );
}

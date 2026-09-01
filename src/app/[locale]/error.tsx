'use client';

/**
 * Error boundary раздела: layout цел, поэтому доступны i18n и токены.
 * Технические детали ошибки пользователю не показываются — только `digest`
 * для сопоставления с логами поддержки.
 */

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { clientEnv } from '@/config/env';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors.generic');

  useEffect(() => {
    /** SDK подгружается лениво: он не должен весить в начальном бандле. */
    if (clientEnv.NEXT_PUBLIC_SENTRY_DSN) {
      void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error));
    }
  }, [error]);

  return (
    <main className="page-container section-y flex min-h-[70vh] flex-col items-center justify-center text-center">
      <h1 className="text-heading-2 mb-4">{t('title')}</h1>
      <p className="text-body mb-8 max-w-md text-content-secondary">{t('description')}</p>
      <Button onClick={reset} size="lg">
        {t('cta')}
      </Button>
      {error.digest && (
        <p className="text-caption mt-8 text-content-tertiary">{error.digest}</p>
      )}
    </main>
  );
}

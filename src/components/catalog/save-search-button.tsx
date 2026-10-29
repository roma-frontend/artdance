'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { apiRoutes } from '@/config/routes';
import type { SearchScope } from '@/domain/search';
import { Link } from '@/i18n/routing';

type SaveStatus = 'idle' | 'saving' | 'done' | 'limit' | 'error';

/**
 * Кнопка «Сохранить поиск» на странице результатов (C-05).
 * Гость видит ссылку на вход, вошедший пользователь сохраняет запрос и область через API.
 */
export function SaveSearchButton({
  query,
  scope,
  signedIn,
  signInHref,
}: {
  query: string;
  scope: SearchScope;
  signedIn: boolean;
  signInHref: string;
}) {
  const t = useTranslations('search');
  const [status, setStatus] = useState<SaveStatus>('idle');

  if (!signedIn) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href={signInHref}>{t('saveSearchSignIn')}</Link>
      </Button>
    );
  }

  async function save() {
    setStatus('saving');
    try {
      const response = await fetch(apiRoutes.savedSearches(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, scope }),
      });
      if (response.ok) {
        setStatus('done');
        return;
      }
      const body = (await response.json().catch(() => null)) as { messageKey?: string } | null;
      setStatus(body?.messageKey === 'savedSearches.limitReached' ? 'limit' : 'error');
    } catch {
      setStatus('error');
    }
  }

  const message =
    status === 'done'
      ? t('saveSearchDone')
      : status === 'limit'
        ? t('saveSearchLimit')
        : status === 'error'
          ? t('saveSearchError')
          : '';

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="outline" size="sm" onClick={save} disabled={status === 'saving' || status === 'done'}>
        {t('saveSearch')}
      </Button>
      <p role="status" aria-live="polite" className="text-body-sm text-content-secondary">
        {message}
      </p>
    </div>
  );
}

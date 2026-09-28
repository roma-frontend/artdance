'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export function DataDeleteSection() {
  const t = useTranslations('footer');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const onDelete = async () => {
    if (!confirm(t('confirmDeleteAccount'))) return;
    setPending(true);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Ошибка');
      setResult(t('deletionAccepted'));
    } catch (e: unknown) {
      setResult(e instanceof Error ? e.message : t('common.states.error' as never) as string);
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="rounded-xl border border-border-default bg-surface-card p-5">
      <h2 className="text-card-title">{t('deleteTitle')}</h2>
      <p className="text-body-sm mt-2 text-content-secondary">{t('deleteHint')}</p>
      <Button variant="outline" className="mt-4" disabled={pending} onClick={onDelete}>{pending ? '…' : t('requestDeletion')}</Button>
      {result && <p role="status" className="text-body-sm mt-3 text-content-secondary">{result}</p>}
    </section>
  );
}

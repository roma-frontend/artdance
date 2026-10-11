'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export function DataExportSection() {
  const t = useTranslations('footer');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onExport = async () => {
    setError(null);
    setDownloading(true);
    try {
      const res = await fetch('/api/account/export');
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'artdance-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.states.error' as never) as string);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="min-w-0 rounded-xl border border-border-default bg-surface-card p-5">
      <h2 className="text-card-title">{t('exportTitle')}</h2>
      <p className="text-body-sm mt-2 text-content-secondary">{t('exportHint')}</p>
      <Button variant="outline" className="mt-4" disabled={downloading} onClick={onExport}>{downloading ? '…' : t('downloadJson')}</Button>
      {error && <p role="alert" className="text-body-sm mt-3 text-content-signal">{error}</p>}
    </section>
  );
}

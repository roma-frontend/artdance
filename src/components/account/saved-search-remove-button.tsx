'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { apiRoutes } from '@/config/routes';
import { useRouter } from '@/i18n/routing';

/** Удаление сохранённого поиска. После успеха обновляет страницу, чтобы список пришёл с сервера заново. */
export function SavedSearchRemoveButton({ id }: { id: string }) {
  const t = useTranslations('savedSearches');
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      const response = await fetch(apiRoutes.savedSearch(id), { method: 'DELETE' });
      if (response.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={remove} disabled={pending}>
      {t('remove')}
    </Button>
  );
}

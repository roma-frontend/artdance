'use client';

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/routing';
import { setSupportTicketStatus } from '@/server/actions/admin/support';

export function SupportTicketActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations('admin.support');
  const router = useRouter();
  const action = useAction(setSupportTicketStatus, { onSuccess: () => router.refresh() });

  return (
    <div className="flex flex-wrap gap-2">
      {status !== 'PENDING' ? <Button size="sm" variant="outline" disabled={action.status === 'executing'} onClick={() => action.execute({ id, status: 'PENDING' })}>{t('markPending')}</Button> : null}
      {status !== 'RESOLVED' ? <Button size="sm" variant="accent" disabled={action.status === 'executing'} onClick={() => action.execute({ id, status: 'RESOLVED' })}>{t('resolve')}</Button> : null}
    </div>
  );
}

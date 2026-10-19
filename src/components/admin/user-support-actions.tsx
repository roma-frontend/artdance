'use client';

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { revokeAllUserSessions } from '@/server/actions/admin/operator';
import { useRouter } from '@/i18n/routing';

export function UserSupportActions({ userId, email }: { userId: string; email: string }) {
  const t = useTranslations('admin.users');
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const action = useAction(revokeAllUserSessions, { onSuccess: () => { setConfirm(false); router.refresh(); } });
  const copy = async (value: string) => { await navigator.clipboard?.writeText(value); };

  return (
    <div className="mt-5 border-t border-border-subtle pt-5">
      <p className="text-label uppercase text-content-secondary">{t('supportActionsTitle')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void copy(userId)}>{t('copyUserId')}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void copy(email)}>{t('copyEmail')}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm((value) => !value)}>{t('revokeSessions')}</Button>
      </div>
      {confirm ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/30 dark:bg-amber-950/20"><p className="text-body-sm text-amber-900 dark:text-amber-100">{t('revokeSessionsHint')}</p><div className="mt-3 flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setConfirm(false)} disabled={action.status === 'executing'}>{t('cancelAction')}</Button><Button type="button" size="sm" variant="default" pending={action.status === 'executing'} onClick={() => action.execute({ userId })}>{t('confirmRevokeSessions')}</Button></div></div> : null}
    </div>
  );
}

'use client';

/**
 * APPROVAL ACTIONS — решение по заявке второго администратора.
 *
 * Одобрение не выполняет операцию: оно даёт разрешение выполнить. Это видно и в
 * тексте, и в поведении — после одобрения заявка исчезает из очереди, а исполнение
 * происходит своим действием со своей записью в журнале. Автоматическое исполнение
 * здесь означало бы, что возврат помечен отправленным без обращения к банку.
 */

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ActionError } from '@/components/admin/status-actions';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import { decideApproval } from '@/server/actions/admin/people';

export function ApprovalActions({ id, isAuthor }: { id: string; isAuthor: boolean }) {
  const t = useTranslations('admin.approvals');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();
  const [note, setNote] = useState('');

  const { execute, status, result } = useAction(decideApproval, {
    onSuccess: () => router.refresh(),
  });

  const busy = status === 'executing';

  if (isAuthor) {
    return <p className="text-body-sm text-content-tertiary">{t('selfBlocked')}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label htmlFor={`note-${id}`} className="text-label uppercase text-content-secondary">
          {t('noteLabel')}
        </label>
        <input
          id={`note-${id}`}
          type="text"
          value={note}
          disabled={busy}
          onChange={(event) => setNote(event.target.value)}
          className="form-input"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="accent"
          size="sm"
          disabled={busy}
          onClick={() => execute({ id, approve: true, ...(note ? { note } : {}) })}
        >
          {tRoot('admin.actions.approve')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => execute({ id, approve: false, ...(note ? { note } : {}) })}
        >
          {tRoot('admin.actions.reject')}
        </Button>
      </div>

      <ActionError error={result.serverError} t={tRoot} />
    </div>
  );
}

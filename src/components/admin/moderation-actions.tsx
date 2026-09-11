'use client';

/**
 * MODERATION ACTIONS — одобрить или отклонить один элемент очереди.
 *
 * Отклонение требует причину, и это не формальность: автор увидит её и должен
 * понять, что исправить. Молчаливый отказ порождает второй такой же отзыв и
 * обращение в поддержку.
 *
 * Поле причины появляется только при отклонении: показывать его всегда значит
 * заставлять модератора думать о нём при каждом одобрении.
 */

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ActionError } from '@/components/admin/status-actions';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import { moderateItem } from '@/server/actions/admin/operations';

interface ModerationActionsProps {
  kind: 'reviews' | 'instructors' | 'venues';
  id: string;
}

export function ModerationActions({ kind, id }: ModerationActionsProps) {
  const t = useTranslations('admin.moderation');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const { execute, status, result } = useAction(moderateItem, {
    onSuccess: () => {
      setRejecting(false);
      setReason('');
      router.refresh();
    },
  });

  const busy = status === 'executing';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="accent"
          size="sm"
          disabled={busy}
          onClick={() => execute({ kind, id, approve: true })}
        >
          {tRoot('admin.actions.approve')}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setRejecting((current) => !current)}
        >
          {tRoot('admin.actions.reject')}
        </Button>
      </div>

      {rejecting ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`reject-${id}`} className="text-label uppercase text-content-secondary">
            {t('rejectReasonLabel')}
          </label>
          <textarea
            id={`reject-${id}`}
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="form-input resize-y"
          />
          <p className="text-caption text-content-tertiary">{t('rejectReasonHint')}</p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || reason.trim().length < 3}
            onClick={() => execute({ kind, id, approve: false, reason })}
          >
            {tRoot('admin.actions.reject')}
          </Button>
        </div>
      ) : null}

      <ActionError error={result.serverError} t={tRoot} />
    </div>
  );
}

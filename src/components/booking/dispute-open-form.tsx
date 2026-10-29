'use client';

/**
 * DISPUTE OPEN FORM — клиент открывает спор по своей брони.
 *
 * Причина проверяется дважды: на клиенте (кнопка неактивна до минимальной
 * длины) и на сервере (`openDisputeAction`). Срок и участие проверяет сервис,
 * форма их не знает и только показывает результат запроса.
 */

import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';

import { ActionError } from '@/components/admin/status-actions';
import { Button } from '@/components/ui/button';
import { disputeLengths } from '@/domain/dispute';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import { openDisputeAction } from '@/server/actions/disputes';

export function DisputeOpenForm({ bookingId }: { bookingId: string }) {
  const t = useTranslations('dispute');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();
  const [reason, setReason] = useState('');
  const { execute, status, result } = useAction(openDisputeAction, {
    onSuccess: () => router.refresh(),
  });
  const pending = status === 'executing';
  const valid = reason.trim().length >= disputeLengths.min;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-sm text-content-secondary">{t('intro')}</p>
      <label htmlFor="dispute-reason" className="text-body-sm font-semibold">
        {t('reasonLabel')}
      </label>
      <textarea
        id="dispute-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, disputeLengths.max))}
        maxLength={disputeLengths.max}
        rows={4}
        className="form-input"
        placeholder={t('reasonPlaceholder')}
        disabled={pending}
      />
      <p className="text-caption text-content-tertiary">{t('reasonHint', { min: disputeLengths.min })}</p>
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={pending || !valid}
          onClick={() => execute({ bookingId, reason })}
        >
          {t('open')}
        </Button>
      </div>
      {result.validationErrors ? (
        <p role="alert" className="text-body-sm text-content-signal">{t('reasonInvalid')}</p>
      ) : null}
      <ActionError error={result.serverError} t={tRoot} />
    </div>
  );
}

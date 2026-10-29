'use client';

/**
 * DISPUTE RESOLVE BUTTONS — решение модератора по открытому спору.
 *
 * Два исхода: прав заявитель или ответчик. Смену статуса и штраф проигравшей
 * стороне сервис пишет в одной транзакции; повторное решение он отклоняет.
 * Кнопки блокируются на время запроса, чтобы не отправить решение дважды.
 */

import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';

import { ActionError } from '@/components/admin/status-actions';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import { resolveDisputeAction } from '@/server/actions/disputes';

export function DisputeResolveButtons({ id }: { id: string }) {
  const t = useTranslations('admin.moderation');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();
  const { execute, status, result } = useAction(resolveDisputeAction, {
    onSuccess: () => router.refresh(),
  });
  const pending = status === 'executing';

  return (
    <div className="flex flex-col gap-3">
      <p className="text-caption text-content-tertiary">{t('disputeHint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="accent"
          size="sm"
          disabled={pending}
          onClick={() => execute({ disputeId: id, winner: 'CLAIMANT' })}
        >
          {t('disputeWinClaimant')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => execute({ disputeId: id, winner: 'RESPONDENT' })}
        >
          {t('disputeWinRespondent')}
        </Button>
      </div>
      <ActionError error={result.serverError} t={tRoot} />
    </div>
  );
}

'use client';

/**
 * Кнопки модерации буста в списке админки. Одобрение поднимает размещение инструктора,
 * поэтому действие требует явного нажатия, без выбора строк и массовых действий.
 */

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';

import { ActionError } from '@/components/admin/status-actions';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import { moderateBoost } from '@/server/actions/admin/boost';

interface BoostModerationButtonsProps {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export function BoostModerationButtons({ id, status }: BoostModerationButtonsProps) {
  const t = useTranslations('boost.moderate');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();

  const { execute, status: actionStatus, result } = useAction(moderateBoost, {
    onSuccess: () => router.refresh(),
  });
  const busy = actionStatus === 'executing';

  if (status !== 'PENDING') return <ActionError error={result.serverError} t={tRoot} />;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => execute({ id, approve: true })}>
          {t('approve')}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => execute({ id, approve: false })}>
          {t('reject')}
        </Button>
      </div>
      <ActionError error={result.serverError} t={tRoot} />
    </div>
  );
}

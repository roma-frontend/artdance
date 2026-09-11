'use client';

/**
 * TRASH ACTIONS — вернуть запись или стереть её навсегда.
 *
 * Две кнопки с намеренно разным весом. «Вернуть» — обычное действие: у него есть
 * откат (удалить снова), поэтому подтверждения нет, оно только мешало бы.
 * «Удалить навсегда» отката не имеет, поэтому подтверждение обязательно и
 * называет запись по имени: диалог «Удалить?» в списке из двадцати строк не
 * говорит, какую именно, и нажимают его не читая.
 *
 * Обновление списка — `router.refresh()`, а не удаление строки на клиенте:
 * страница серверная, счётчики разделов считает сервер, и «строка исчезла, а
 * счётчик показывает прежнее» выглядит поломкой.
 */

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { AdminResource } from '@/config';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import type { MessageKey } from '@/i18n/types';
import { purgeAdminResource, restoreAdminResource } from '@/server/actions/admin/trash';

interface TrashActionsProps {
  resource: AdminResource;
  id: string;
  /** Название записи — подставляется в подтверждение. */
  label: string;
  canRestore: boolean;
  canPurge: boolean;
}

export function TrashActions({ resource, id, label, canRestore, canPurge }: TrashActionsProps) {
  const t = useTranslations('admin.trash');
  const tActions = useTranslations('admin.actions');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();

  const restore = useAction(restoreAdminResource, { onSuccess: () => router.refresh() });
  const purge = useAction(purgeAdminResource, { onSuccess: () => router.refresh() });

  const busy = restore.status === 'executing' || purge.status === 'executing';
  const error = restore.result.serverError ?? purge.result.serverError;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {error ? (
        <p role="alert" className="text-caption font-semibold text-content-danger">
          {tRoot(error.messageKey as MessageKey, error.params)}
        </p>
      ) : null}

      {canRestore ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => restore.execute({ resource, id })}
        >
          {tActions('restore')}
        </Button>
      ) : null}

      {canPurge ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" disabled={busy}>
              {tActions('purge')}
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tActions('purge')}</AlertDialogTitle>
              <AlertDialogDescription>{t('purgeConfirm', { name: label })}</AlertDialogDescription>
            </AlertDialogHeader>

            <p className="text-body-sm text-content-secondary">{t('purgeNotice')}</p>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>{tRoot('common.actions.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                disabled={busy}
                onClick={(event) => {
                  /* Диалог не закрывается сам: ответ сервера может быть отказом. */
                  event.preventDefault();
                  purge.execute({ resource, id });
                }}
              >
                {tActions('purge')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}

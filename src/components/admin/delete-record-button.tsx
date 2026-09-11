'use client';

/**
 * DELETE RECORD BUTTON — удаление записи с подтверждением.
 *
 * Подтверждение обязательно и обязательно называет последствия: у большинства
 * сущностей каскад уносит связанные записи (у занятия — проведения, у площадки —
 * залы, у товара — варианты). «Удалить?» без этого предложения — не
 * подтверждение, а формальность, которую нажимают не читая.
 *
 * Отказ сервера показывается здесь же: если запись удалить нельзя (не хватает
 * права, есть связанные записи), человек должен узнать это в том же месте, где
 * нажал, а не после перехода на список.
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
import { deleteAdminResource } from '@/server/actions/admin/resource';

interface DeleteRecordButtonProps {
  resource: AdminResource;
  id: string;
  /** Куда вернуться после удаления. */
  listHref: string;
}

export function DeleteRecordButton({ resource, id, listHref }: DeleteRecordButtonProps) {
  const t = useTranslations('admin.form');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();

  const { execute, status, result } = useAction(deleteAdminResource, {
    onSuccess: () => router.push(listHref),
  });

  const isDeleting = status === 'executing';
  const serverError = result.serverError;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm">
          {t('deleteConfirm')}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('deleteBody')}</AlertDialogDescription>
        </AlertDialogHeader>

        {serverError ? (
          <p role="alert" className="text-body-sm font-semibold text-content-danger">
            {tRoot(serverError.messageKey as MessageKey, serverError.params)}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{tRoot('common.actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isDeleting}
            onClick={(event) => {
              /* Диалог не закрывается сам: ответ сервера может быть отказом. */
              event.preventDefault();
              execute({ resource, id });
            }}
          >
            {t('deleteConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

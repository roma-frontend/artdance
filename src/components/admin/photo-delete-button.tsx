'use client';

/**
 * PHOTO DELETE BUTTON — убрать кадр прямо из формы правки.
 *
 * До этого удалить фотографию можно было только одним путём: открыть запись
 * медиа в отдельном разделе и удалить её там. То есть чтобы убрать неудачный
 * кадр у инструктора, надо было уйти со страницы инструктора — и вернуться,
 * потеряв несохранённые правки формы.
 *
 * Кнопка не уводит со страницы: удаление уносит кадр в корзину, а список кадров
 * обновляется `router.refresh()`. Форма при этом остаётся заполненной — это и
 * есть причина делать удаление здесь, а не ссылкой в другой раздел.
 *
 * Подтверждение есть, но короткое: кадр уходит в корзину и восстановим, поэтому
 * пугать текстом про необратимость было бы неправдой. Необратимое удаление живёт
 * в разделе «Корзина», и только там.
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
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import type { MessageKey } from '@/i18n/types';
import { deleteAdminResource } from '@/server/actions/admin/resource';

interface PhotoDeleteButtonProps {
  /** Идентификатор записи медиа, а не владельца кадра. */
  assetId: string;
  /** Альтернативный текст: он же название кадра в подтверждении. */
  altText: string;
}

export function PhotoDeleteButton({ assetId, altText }: PhotoDeleteButtonProps) {
  const t = useTranslations('admin.media');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();

  const { execute, status, result } = useAction(deleteAdminResource, {
    onSuccess: () => router.refresh(),
  });

  const busy = status === 'executing';
  const serverError = result.serverError;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={busy}>
          {t('deletePhoto')}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deletePhoto')}</AlertDialogTitle>
          <AlertDialogDescription>{t('deletePhotoBody', { name: altText })}</AlertDialogDescription>
        </AlertDialogHeader>

        {serverError ? (
          <p role="alert" className="text-body-sm font-semibold text-content-danger">
            {tRoot(serverError.messageKey as MessageKey, serverError.params)}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{tRoot('common.actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              /* Диалог не закрывается сам: ответ сервера может быть отказом. */
              event.preventDefault();
              execute({ resource: 'media', id: assetId });
            }}
          >
            {t('deletePhoto')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

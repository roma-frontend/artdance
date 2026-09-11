'use client';

/**
 * BULK ACTION BAR — массовые действия над выбранными строками.
 *
 * Форма-обёртка вокруг серверной таблицы. Выбор строк не хранится в React:
 * чекбоксы таблицы — обычные `<input name="ids">`, и список выбранного читается
 * из `FormData` в момент действия. Благодаря этому таблица остаётся серверным
 * компонентом (см. `data-table.tsx`), а выбор сорока строк не стоит сорока
 * перерисовок.
 *
 * Три вещи, которые здесь обязательны:
 *  • счётчик выбранного — иначе «удалить» нажимают, не понимая, что выбрано;
 *  • предел `maxBulkActionItems` — тот же, что проверяет сервер: интерфейс должен
 *    объяснить ограничение до отправки, но не является защитой;
 *  • подтверждение для удаления — необратимая операция над множеством записей.
 */

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { security } from '@/config/business';
import type { AdminResource } from '@/config';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import type { MessageKey } from '@/i18n/types';
import { runAdminBulkAction, type AdminBulkAction } from '@/server/actions/admin/resource';

interface BulkActionBarProps {
  resource: AdminResource;
  /** Доступные действия. Пустой список — панель не показывается. */
  actions: readonly AdminBulkAction[];
  children: React.ReactNode;
}

const actionLabelKey: Record<AdminBulkAction, MessageKey> = {
  activate: 'admin.actions.activate',
  deactivate: 'admin.actions.deactivate',
  publish: 'admin.actions.publish',
  unpublish: 'admin.actions.unpublish',
  delete: 'admin.form.deleteConfirm',
};

export function BulkActionBar({ resource, actions, children }: BulkActionBarProps) {
  const t = useTranslations('admin.list');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();

  const formRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState(0);
  const [pendingDelete, setPendingDelete] = useState(false);

  const { execute, status, result } = useAction(runAdminBulkAction, {
    onSuccess: () => {
      setPendingDelete(false);
      setSelected(0);
      formRef.current?.reset();
      router.refresh();
    },
  });

  const limit = security.guardrails.maxBulkActionItems;
  const isRunning = status === 'executing';
  const overLimit = selected > limit;
  const serverError = result.serverError;

  function selectedIds(): string[] {
    const form = formRef.current;
    if (!form) return [];
    return new FormData(form)
      .getAll('ids')
      .filter((value): value is string => typeof value === 'string');
  }

  function run(action: AdminBulkAction): void {
    const ids = selectedIds();
    if (ids.length === 0) return;
    execute({ resource, action, ids });
  }

  return (
    <form
      ref={formRef}
      /* Счётчик пересчитывается по событию формы: слушать каждый чекбокс не нужно. */
      onChange={() => setSelected(selectedIds().length)}
      onSubmit={(event) => event.preventDefault()}
      className="flex flex-col gap-4"
    >
      {children}

      {actions.length > 0 ? (
        <div
          aria-live="polite"
          className="flex flex-wrap items-center gap-3 rounded-md border border-border-default bg-surface-raised px-4 py-3"
        >
          <p className="text-body-sm text-content-secondary">
            {selected === 0 ? t('selectRow') : t('selectedCount', { count: selected })}
          </p>

          {overLimit ? (
            <p role="alert" className="text-body-sm font-semibold text-content-danger">
              {t('bulkLimit', { max: limit })}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {actions.map((action) =>
              action === 'delete' ? (
                <Button
                  key={action}
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={selected === 0 || overLimit || isRunning}
                  onClick={() => setPendingDelete(true)}
                >
                  {tRoot(actionLabelKey[action])}
                </Button>
              ) : (
                <Button
                  key={action}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={selected === 0 || overLimit || isRunning}
                  onClick={() => run(action)}
                >
                  {tRoot(actionLabelKey[action])}
                </Button>
              ),
            )}
          </div>

          {serverError ? (
            <p role="alert" className="text-body-sm font-semibold text-content-danger">
              {tRoot(serverError.messageKey as MessageKey, serverError.params)}
            </p>
          ) : null}
        </div>
      ) : null}

      <AlertDialog open={pendingDelete} onOpenChange={setPendingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tRoot('admin.form.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{tRoot('admin.form.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRunning}>{tRoot('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRunning}
              onClick={(event) => {
                event.preventDefault();
                run('delete');
              }}
            >
              {tRoot('admin.form.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

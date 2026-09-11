'use client';

/**
 * USER ACCESS ACTIONS — смена роли и блокировка аккаунта.
 *
 * Два самых опасных действия в разделе людей, поэтому оба показывают последствия
 * до нажатия: роль меняет права на всей платформе, блокировка обрывает активные
 * сессии немедленно. Сервер дополнительно не даёт снять доступ себе и последнему
 * администратору — интерфейс говорит об этом заранее, чтобы отказ не выглядел
 * поломкой.
 */

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ActionError } from '@/components/admin/status-actions';
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
import { userRoleLabelKey, userRoles, type UserRole } from '@/domain/enums';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import { changeUserRole, setUserActive } from '@/server/actions/admin/people';

interface UserAccessActionsProps {
  id: string;
  currentRole: UserRole;
  isActive: boolean;
  /** Свой собственный аккаунт: действия запрещены и объясняют почему. */
  isSelf: boolean;
  /** Последний активный администратор: снять доступ нельзя. */
  isLastAdmin: boolean;
  canChangeRole: boolean;
  canSuspend: boolean;
}

export function UserAccessActions({
  id,
  currentRole,
  isActive,
  isSelf,
  isLastAdmin,
  canChangeRole,
  canSuspend,
}: UserAccessActionsProps) {
  const t = useTranslations('admin.users');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();

  const [role, setRole] = useState<UserRole>(currentRole);
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  const roleAction = useAction(changeUserRole, { onSuccess: () => router.refresh() });
  const activeAction = useAction(setUserActive, {
    onSuccess: () => {
      setConfirmSuspend(false);
      router.refresh();
    },
  });

  const busy = roleAction.status === 'executing' || activeAction.status === 'executing';

  if (isSelf) {
    return <p className="text-body-sm text-content-tertiary">{t('selfNotice')}</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {canChangeRole ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="user-role" className="text-label uppercase text-content-secondary">
            {t('roleTitle')}
          </label>
          <select
            id="user-role"
            value={role}
            disabled={busy}
            onChange={(event) => setRole(event.target.value as UserRole)}
            className="form-input"
          >
            {userRoles.map((value) => (
              <option key={value} value={value}>
                {tRoot(userRoleLabelKey(value))}
              </option>
            ))}
          </select>
          <p className="text-caption text-content-tertiary">{t('roleWarning')}</p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || role === currentRole}
            onClick={() => roleAction.execute({ id, role })}
          >
            {t('roleCta')}
          </Button>
          <ActionError error={roleAction.result.serverError} t={tRoot} />
        </div>
      ) : null}

      {canSuspend ? (
        <div className="flex flex-col gap-2">
          {isLastAdmin && isActive ? (
            <p className="text-body-sm text-content-warning">{t('lastAdminNotice')}</p>
          ) : null}

          {isActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || isLastAdmin}
              onClick={() => setConfirmSuspend(true)}
            >
              {tRoot('admin.actions.suspend')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => activeAction.execute({ id, active: true })}
            >
              {tRoot('admin.actions.restore')}
            </Button>
          )}

          <ActionError error={activeAction.result.serverError} t={tRoot} />
        </div>
      ) : null}

      <AlertDialog open={confirmSuspend} onOpenChange={setConfirmSuspend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('suspendTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('suspendBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tRoot('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                activeAction.execute({ id, active: false });
              }}
            >
              {tRoot('admin.actions.suspend')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

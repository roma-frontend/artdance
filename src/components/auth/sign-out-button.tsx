/**
 * SIGN OUT BUTTON — выход из аккаунта.
 *
 * Кнопка, а не ссылка на эндпоинт, и это не стиль: выход — мутация. Ссылку
 * открывает превью в мессенджере, префетч браузера и антивирусный сканер почты, и
 * человек оказывается разлогинен, ничего не нажимая.
 *
 * После выхода — `router.refresh()`, а не переход: серверные компоненты обязаны
 * перечитать состояние, иначе шапка продолжает показывать имя вышедшего
 * пользователя до следующей навигации.
 */

'use client';

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { routes } from '@/config';
import { useRouter } from '@/i18n/routing';
import { signOutAction } from '@/server/actions/auth';

export function SignOutButton() {
  const t = useTranslations('common.actions');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const { execute, status } = useAction(signOutAction, {
    onSuccess: () => {
      router.replace(routes.home());
      router.refresh();
    },
  });

  const isSubmitting = status === 'executing';

  return (
    <Button variant="ghost" onClick={() => execute()} disabled={isSubmitting}>
      {isSubmitting ? tCommon('states.processing') : t('signOut')}
    </Button>
  );
}

'use client';

/**
 * EMAIL TEST SEND — отправка выбранного шаблона на адрес вошедшего администратора.
 *
 * Адрес берётся на сервере из сессии, а не из формы: тестовое письмо нельзя отправить
 * на произвольный адрес. Кнопка блокируется на время запроса. Причину отказа провайдера
 * не показываем: достаточно «не отправлено» и подсказки проверить почтовую интеграцию.
 */

import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';

import type { NotificationType } from '@/config/notifications';
import { ActionError } from '@/components/admin/status-actions';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import type { Translate } from '@/i18n/translate';
import { sendPreviewEmail } from '@/server/actions/admin/people';

export function EmailTestSendButton({ type, locale }: { type: NotificationType; locale: Locale }) {
  const t = useTranslations('admin.emails');
  const tRoot = useTranslations() as unknown as Translate;
  const { execute, status, result } = useAction(sendPreviewEmail);
  const pending = status === 'executing';
  const sent = result.data?.sent;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => execute({ type, locale })}>
          {pending ? t('sendingTest') : t('sendTest')}
        </Button>
      </div>
      {sent !== undefined ? (
        <p role="status" className="text-body-sm">
          {sent ? t('testSent') : t('testNotSent')}
        </p>
      ) : null}
      <ActionError error={result.serverError} t={tRoot} />
    </div>
  );
}

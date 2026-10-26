'use client';

/**
 * Панель безопасности аккаунта: устройства с открытой сессией, выход с остальных
 * и резервные коды. Список сессий приходит с сервера без токенов.
 */

import { useLocale, useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { useState, type FormEvent } from 'react';

import { FormField } from '@/components/ui/form-field';
import { Button } from '@/components/ui/button';
import type { MessageKey } from '@/i18n/types';
import { generateBackupCodesAction, signOutOtherDevicesAction } from '@/server/actions/account-security';

export interface SecuritySession {
  id: string;
  userAgent: string | null;
  /** ISO-строка: объект Date не сериализуется через границу сервер–клиент. */
  createdAt: string;
  current: boolean;
}

export function SecurityPanel({ sessions }: { sessions: readonly SecuritySession[] }) {
  const t = useTranslations('account.security');
  const tRoot = useTranslations();
  const locale = useLocale();
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState<readonly string[] | null>(null);

  const signOut = useAction(signOutOtherDevicesAction);
  const generate = useAction(generateBackupCodesAction, {
    onSuccess: ({ data }) => {
      setCodes(data?.codes ?? null);
      setPassword('');
    },
  });

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

  const submitBackup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password || generate.status === 'executing') return;
    generate.execute({ password });
  };

  const signOutError = signOut.result.serverError;
  const generateError = generate.result.serverError;

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="security-sessions" className="flex flex-col gap-4">
        <h2 id="security-sessions" className="text-heading-3">
          {t('sessionsTitle')}
        </h2>
        <ul className="flex flex-col gap-3">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border-default p-4"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-body truncate font-semibold">
                  {session.userAgent ? session.userAgent.slice(0, 80) : t('sessionUnknown')}
                </p>
                <p className="text-caption text-content-secondary">
                  {t('sessionStarted', { date: formatDate(session.createdAt) })}
                </p>
              </div>
              {session.current && (
                <span className="text-caption shrink-0 font-semibold text-content-accent">
                  {t('sessionCurrent')}
                </span>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-col items-start gap-2">
          <Button
            type="button"
            variant="accent"
            onClick={() => signOut.execute()}
            disabled={signOut.status === 'executing'}
          >
            {t('signOutOthers')}
          </Button>
          {signOut.status === 'hasSucceeded' && (
            <p role="status" className="text-body-sm text-content-secondary">
              {t('signOutOthersDone')}
            </p>
          )}
          {signOutError && (
            <p role="alert" className="text-body-sm font-semibold text-content-danger">
              {tRoot(signOutError.messageKey as MessageKey, signOutError.params)}
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="security-backup" className="flex flex-col gap-4">
        <h2 id="security-backup" className="text-heading-3">
          {t('backupTitle')}
        </h2>
        <p className="text-body-sm text-content-secondary">{t('backupHint')}</p>

        {codes && (
          <div className="flex flex-col gap-3 rounded-lg border border-border-default p-4">
            <p className="text-body-sm font-semibold">{t('backupSaveNotice')}</p>
            <ul className="grid grid-cols-2 gap-2 font-mono text-body">
              {codes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={submitBackup} className="flex max-w-sm flex-col gap-4">
          <FormField name="backupPassword" labelKey="account.security.backupPassword" required>
            {(field) => (
              <input
                id={field.id}
                name={field.name}
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value.slice(0, 128))}
                aria-describedby={field.describedBy}
                disabled={generate.status === 'executing'}
                className="form-input"
              />
            )}
          </FormField>

          {generateError && (
            <p role="alert" className="text-body-sm font-semibold text-content-danger">
              {tRoot(generateError.messageKey as MessageKey, generateError.params)}
            </p>
          )}

          <Button type="submit" variant="accent" disabled={!password || generate.status === 'executing'}>
            {t('backupGenerate')}
          </Button>
        </form>
      </section>
    </div>
  );
}

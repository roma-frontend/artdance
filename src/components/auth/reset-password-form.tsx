/**
 * RESET PASSWORD FORM — новый пароль по ссылке из письма.
 *
 * **Токен приходит пропсом из query, а не читается здесь.** Страница получает его
 * на сервере и отдаёт форме: чтение адресной строки в компоненте означало бы, что
 * форма работает по-разному до и после гидратации.
 *
 * **Подтверждение пароля есть.** Обычно поле «повторите» — рудимент, но здесь
 * опечатка обходится дорого: человек не увидит нового пароля никогда, а ссылка
 * из письма уже использована. Сравнение делает та же схема, что и сервер.
 *
 * **После успеха — ссылка на вход, а не автоматический вход.** Смена пароля
 * инвалидирует остальные сессии, и молча пустить человека внутрь означало бы
 * скрыть от него, что произошло с его аккаунтом.
 */

'use client';

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { routes } from '@/config';
import { passwordRequirements } from '@/domain/auth';
import { Link } from '@/i18n/routing';
import type { MessageKey } from '@/i18n/types';
import { resetPasswordAction } from '@/server/actions/auth';

interface ResetPasswordFormProps {
  /** Токен из письма. Пустая строка — ссылка открыта без него. */
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations('auth.resetPassword');
  const tRoot = useTranslations();
  const tCommon = useTranslations('common');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { execute, status, result } = useAction(resetPasswordAction);

  const isSubmitting = status === 'executing';
  const serverError = result.serverError;
  const validation = result.validationErrors;

  const mismatch =
    validation !== undefined && 'confirmPassword' in validation
      ? ('validation.passwordsDoNotMatch' as MessageKey)
      : null;

  /* Ссылка без токена — не форма, а объяснение. */
  if (token.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="text-body-sm font-semibold text-content-danger">
          {t('invalidToken')}
        </p>
        <Link
          href={routes.forgotPassword()}
          className="text-body-sm text-content-accent underline"
        >
          {tRoot('auth.forgotPassword.title')}
        </Link>
      </div>
    );
  }

  if (result.data?.updated) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" aria-live="polite" className="text-body-sm text-content-secondary">
          {t('success')}
        </p>
        <Button asChild variant="accent" size="lg" block>
          <Link href={routes.signIn()}>{tRoot('auth.signIn.submit')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        execute({ token, password, confirmPassword });
      }}
      className="flex flex-col gap-5"
    >
      <FormField
        name="password"
        labelKey="auth.resetPassword.newPassword"
        hintKey="validation.passwordTooShort"
        values={{ min: passwordRequirements.minLength }}
        required
      >
        {(field) => (
          <input
            id={field.id}
            name={field.name}
            type="password"
            autoComplete="new-password"
            minLength={passwordRequirements.minLength}
            autoFocus
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={field.describedBy}
            disabled={isSubmitting}
            className="form-input"
          />
        )}
      </FormField>

      <FormField
        name="confirmPassword"
        labelKey="auth.resetPassword.confirmPassword"
        errorKey={mismatch}
        required
      >
        {(field) => (
          <input
            id={field.id}
            name={field.name}
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-invalid={field.invalid || undefined}
            aria-describedby={field.describedBy}
            disabled={isSubmitting}
            className="form-input"
          />
        )}
      </FormField>

      {serverError && (
        <p role="alert" className="text-body-sm font-semibold text-content-danger">
          {tRoot(serverError.messageKey as MessageKey, serverError.params)}
        </p>
      )}

      <Button type="submit" variant="accent" size="lg" block disabled={isSubmitting}>
        {isSubmitting ? tCommon('states.processing') : t('submit')}
      </Button>
    </form>
  );
}

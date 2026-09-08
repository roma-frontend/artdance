/**
 * FORGOT PASSWORD FORM — запрос ссылки для сброса пароля.
 *
 * **Ответ всегда один и тот же.** «Если аккаунт для этого адреса существует,
 * ссылка уже в пути» — и для зарегистрированного адреса, и для выдуманного. Иначе
 * форма сброса становится способом перечислять клиентов платформы, а формулировка
 * в i18n подобрана так, чтобы не обещать письма, которого не будет.
 *
 * **Успех заменяет форму.** Оставленное поле с адресом приглашает нажать второй
 * раз, а второе письмо инвалидирует токен из первого — человек открывает первую
 * ссылку и получает «ссылка недействительна».
 */

'use client';

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { TurnstileField } from '@/components/ui/turnstile-field';
import type { MessageKey } from '@/i18n/types';
import { forgotPasswordAction } from '@/server/actions/auth';

export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgotPassword');
  const tRoot = useTranslations();
  const tCommon = useTranslations('common');

  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const { execute, status, result } = useAction(forgotPasswordAction);

  const isSubmitting = status === 'executing';
  const serverError = result.serverError;

  if (result.data?.sent) {
    return (
      <p role="status" aria-live="polite" className="text-body-sm text-content-secondary">
        {t('sent', { email })}
      </p>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        execute({ email, ...(captchaToken ? { captchaToken } : {}) });
      }}
      className="flex flex-col gap-5"
    >
      <FormField name="email" labelKey="auth.signIn.emailLabel" required>
        {(field) => (
          <input
            id={field.id}
            name={field.name}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-describedby={field.describedBy}
            disabled={isSubmitting}
            className="form-input"
          />
        )}
      </FormField>

      <TurnstileField onToken={setCaptchaToken} />

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

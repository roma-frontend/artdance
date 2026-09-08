/**
 * SIGN UP FORM — регистрация.
 *
 * Отличается от входа тремя вещами, и каждая из них — требование, а не украшение.
 *
 * **Требования к паролю показаны до отправки.** Подсказка строится из
 * `passwordRequirements`, то есть из тех же чисел, что проверяет схема и сервер
 * аутентификации. Узнать про «минимум 10 символов» после отказа — это вторая
 * попытка там, где хватило бы одной.
 *
 * **Согласие с условиями — незаполненная галочка.** Предвыбранное согласие не
 * является согласием ни по GDPR, ни по ЗРА «О защите персональных данных».
 * Ссылки внутри фразы — через `t.rich`, а не склейкой строк: порядок слов в
 * армянском и русском разный, и «принимаю» + ссылка + «и» + ссылка собирается в
 * трёх языках по-разному.
 *
 * **Занятый адрес подсвечивает поле.** Это единственная ошибка регистрации,
 * которая относится к конкретному полю и которую бессмысленно скрывать: не сказав
 * «адрес занят», мы либо молча не регистрируем человека, либо создаём второй
 * аккаунт на тот же адрес.
 */

'use client';

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { TurnstileField } from '@/components/ui/turnstile-field';
import { routes } from '@/config';
import { passwordRequirements } from '@/domain/auth';
import { Link, useRouter } from '@/i18n/routing';
import type { MessageKey } from '@/i18n/types';
import { signUpAction } from '@/server/actions/auth';

interface SignUpFormProps {
  redirectTo?: string | undefined;
}

export function SignUpForm({ redirectTo }: SignUpFormProps) {
  const t = useTranslations('auth.signUp');
  const tRoot = useTranslations();
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const { execute, status, result } = useAction(signUpAction, {
    onSuccess: ({ data }) => {
      if (data?.redirectTo) router.push(data.redirectTo);
    },
  });

  const isSubmitting = status === 'executing';
  const serverError = result.serverError;
  const validation = result.validationErrors;

  /** Поле, названное схемой или сервером. */
  const fieldError = (field: 'name' | 'email' | 'password'): MessageKey | null => {
    if (serverError?.field === field) return serverError.messageKey as MessageKey;
    const issue = validation && field in validation
      ? (validation as Record<string, { _errors?: string[] } | undefined>)[field]?._errors?.[0]
      : undefined;
    return (issue as MessageKey | undefined) ?? null;
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        execute({
          name,
          email,
          password,
          acceptTerms: acceptTerms as true,
          ...(captchaToken ? { captchaToken } : {}),
          ...(redirectTo ? { redirectTo } : {}),
        });
      }}
      className="flex flex-col gap-5"
    >
      <FormField name="name" labelKey="auth.signUp.nameLabel" errorKey={fieldError('name')} required>
        {(field) => (
          <input
            id={field.id}
            name={field.name}
            autoComplete="name"
            autoFocus
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={field.invalid || undefined}
            aria-describedby={field.describedBy}
            disabled={isSubmitting}
            className="form-input"
          />
        )}
      </FormField>

      <FormField
        name="email"
        labelKey="auth.signIn.emailLabel"
        errorKey={fieldError('email')}
        required
      >
        {(field) => (
          <input
            id={field.id}
            name={field.name}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={field.invalid || undefined}
            aria-describedby={field.describedBy}
            disabled={isSubmitting}
            className="form-input"
          />
        )}
      </FormField>

      <FormField
        name="password"
        labelKey="auth.signIn.passwordLabel"
        hintKey="validation.passwordTooShort"
        values={{ min: passwordRequirements.minLength }}
        errorKey={fieldError('password')}
        required
      >
        {(field) => (
          <input
            id={field.id}
            name={field.name}
            type="password"
            autoComplete="new-password"
            minLength={passwordRequirements.minLength}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={field.invalid || undefined}
            aria-describedby={field.describedBy}
            disabled={isSubmitting}
            className="form-input"
          />
        )}
      </FormField>

      <label className="text-body-sm flex items-start gap-3 text-content-secondary">
        <input
          type="checkbox"
          name="acceptTerms"
          checked={acceptTerms}
          onChange={(event) => setAcceptTerms(event.target.checked)}
          disabled={isSubmitting}
          className="mt-0.5 size-5 shrink-0 rounded-sm border border-border-strong accent-accent"
        />
        <span>
          {t.rich('termsConsent', {
            termsLink: (chunks) => (
              <Link href={routes.terms()} className="underline hover:text-content-accent">
                {chunks}
              </Link>
            ),
            privacyLink: (chunks) => (
              <Link href={routes.privacy()} className="underline hover:text-content-accent">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>

      <TurnstileField onToken={setCaptchaToken} />

      {serverError && !serverError.field && (
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

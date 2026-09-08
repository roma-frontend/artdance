/**
 * SIGN IN FORM — вход по адресу и паролю.
 *
 * Форма клиентская, потому что у неё есть состояния отправки. Проверять она
 * ничего не проверяет по-настоящему: и пароль, и блокировку, и капчу проверяет
 * `signInAction` — валидация в браузере только подсказывает.
 *
 * ## Что здесь сделано осознанно
 *
 * **Ошибка входа — одна на форму, а не на поле.** «Неверный адрес или пароль»
 * относится к паре, и подсветить одно из полей значило бы сказать, какое именно
 * неверно, — то самое перечисление адресов, которое закрывает сервер.
 *
 * **Сообщение об ошибке — из ключа, который вернул сервер.** Не «попробуйте
 * снова»: разница между «неверные данные» и «аккаунт заблокирован на 12 минут»
 * определяет, что человек сделает дальше.
 *
 * **`autoComplete` заполнен точно.** `email` и `current-password` — то, по чему
 * менеджеры паролей и iOS-клавиатура понимают форму. Без них автозаполнение
 * ломается, и человек вводит пароль руками на телефоне.
 *
 * **Переход после входа делает сервер, а не форма.** Действие возвращает путь,
 * проверенный на относительность: `?redirectTo=https://зло.example` в адресной
 * строке иначе превращает нашу страницу входа в фишинговый редирект.
 *
 * **Кнопка блокируется на время отправки.** Дважды отправленная форма входа — это
 * две записи в счётчике неудач, если пароль неверен.
 */

'use client';

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { TurnstileField } from '@/components/ui/turnstile-field';
import { routes } from '@/config';
import { Link, useRouter } from '@/i18n/routing';
import type { MessageKey } from '@/i18n/types';
import { signInAction } from '@/server/actions/auth';

interface SignInFormProps {
  /** Куда вернуть после входа. Уже относительный путь: проверено на сервере. */
  redirectTo?: string | undefined;
}

export function SignInForm({ redirectTo }: SignInFormProps) {
  const t = useTranslations('auth.signIn');
  const tRoot = useTranslations();
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const { execute, status, result } = useAction(signInAction, {
    onSuccess: ({ data }) => {
      if (data?.redirectTo) router.push(data.redirectTo);
    },
  });

  const isSubmitting = status === 'executing';
  const serverError = result.serverError;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        execute({
          email,
          password,
          ...(captchaToken ? { captchaToken } : {}),
          ...(redirectTo ? { redirectTo } : {}),
        });
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

      <FormField name="password" labelKey="auth.signIn.passwordLabel" required>
        {(field) => (
          <input
            id={field.id}
            name={field.name}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={field.describedBy}
            disabled={isSubmitting}
            className="form-input"
          />
        )}
      </FormField>

      <TurnstileField onToken={setCaptchaToken} />

      {/*
        Ошибка над кнопкой, а не под ней: под кнопкой на телефоне она оказывается
        за пределами экрана, и человек нажимает второй раз, не увидев причины.
      */}
      {serverError && (
        <p role="alert" className="text-body-sm font-semibold text-content-danger">
          {tRoot(serverError.messageKey as MessageKey, serverError.params)}
        </p>
      )}

      <Button type="submit" variant="accent" size="lg" block disabled={isSubmitting}>
        {isSubmitting ? tCommon('states.processing') : t('submit')}
      </Button>

      <Link
        href={routes.forgotPassword()}
        className="text-caption self-center text-content-secondary underline hover:text-content-accent"
      >
        {t('forgotLink')}
      </Link>
    </form>
  );
}

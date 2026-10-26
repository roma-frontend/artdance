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

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { useEffect, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { TurnstileField } from '@/components/ui/turnstile-field';
import { routes } from '@/config';
import { Link, useRouter } from '@/i18n/routing';
import type { MessageKey } from '@/i18n/types';
import { formatEmailInput } from '@/lib/input-masks';
import {
  sendTwoFactorCodeAction,
  signInAction,
  verifyTwoFactorCodeAction,
} from '@/server/actions/auth';

interface SignInFormProps {
  /** Куда вернуть после входа. Уже относительный путь: проверено на сервере. */
  redirectTo?: string | undefined;
}

/** Длина кода — совпадает с `digits` в конфигурации плагина двухфакторной защиты. */
const CODE_LENGTH = 6;
/** Пауза до повторной отправки кода: защищает от спама письмами и SMS. */
const RESEND_SECONDS = 30;

const STEP_MOTION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: 'easeOut' as const },
};

type Step = 'credentials' | 'code';

export function SignInForm({ redirectTo }: SignInFormProps) {
  const t = useTranslations('auth.signIn');
  const tOtp = useTranslations('auth.otp');
  const tRoot = useTranslations();
  const tCommon = useTranslations('common');
  const router = useRouter();
  const reduce = useReducedMotion();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Порядок важен: обработчик входа вызывает отправку кода, поэтому она объявлена первой.
  const sendCode = useAction(sendTwoFactorCodeAction, {
    onSuccess: () => setCooldown(RESEND_SECONDS),
  });

  const verify = useAction(verifyTwoFactorCodeAction, {
    onSuccess: ({ data }) => {
      if (data?.redirectTo) router.push(data.redirectTo);
    },
    // Неверный или просроченный код: очищаем поле, чтобы человек сразу ввёл заново.
    onError: () => setCode(''),
  });

  const signIn = useAction(signInAction, {
    onSuccess: ({ data }) => {
      if (data?.twoFactor) {
        setTarget(data.twoFactor.target);
        setStep('code');
        sendCode.execute();
        return;
      }
      if (data?.redirectTo) router.push(data.redirectTo);
    },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const isVerifying = verify.status === 'executing' || verify.status === 'hasSucceeded';
  const isBusy = signIn.status === 'executing' || isVerifying;
  const serverError =
    step === 'code'
      ? (verify.result.serverError ?? sendCode.result.serverError)
      : signIn.result.serverError;

  const submitCode = (value: string) => {
    if (value.length !== CODE_LENGTH || isVerifying) return;
    verify.execute({ code: value, ...(redirectTo ? { redirectTo } : {}) });
  };

  const backToCredentials = () => {
    setStep('credentials');
    setCode('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 'code') {
      submitCode(code);
      return;
    }
    signIn.execute({
      email,
      password,
      ...(captchaToken ? { captchaToken } : {}),
      ...(redirectTo ? { redirectTo } : {}),
    });
  };

  const codeComplete = code.length === CODE_LENGTH;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      <AnimatePresence mode="wait" initial={false}>
        {step === 'credentials' ? (
          <motion.div
            key="credentials"
            className="flex flex-col gap-5"
            initial={reduce ? false : STEP_MOTION.initial}
            animate={STEP_MOTION.animate}
            exit={reduce ? { opacity: 0 } : STEP_MOTION.exit}
            transition={STEP_MOTION.transition}
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
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(formatEmailInput(event.target.value))}
                  aria-describedby={field.describedBy}
                  disabled={isBusy}
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
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value.slice(0, 128))}
                  aria-describedby={field.describedBy}
                  disabled={isBusy}
                  className="form-input"
                />
              )}
            </FormField>

            <TurnstileField onToken={setCaptchaToken} />
          </motion.div>
        ) : (
          <motion.div
            key="code"
            className="flex flex-col items-center gap-5"
            initial={reduce ? false : STEP_MOTION.initial}
            animate={STEP_MOTION.animate}
            exit={reduce ? { opacity: 0 } : STEP_MOTION.exit}
            transition={STEP_MOTION.transition}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <h2 className="text-body-lg font-semibold text-content-primary">{tOtp('title')}</h2>
              <p className="text-body-sm text-content-secondary">
                {tOtp('subtitle', { length: CODE_LENGTH, target })}
              </p>
            </div>

            <InputOTP
              maxLength={CODE_LENGTH}
              value={code}
              onChange={setCode}
              onComplete={submitCode}
              pattern={REGEXP_ONLY_DIGITS}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              disabled={isBusy}
              aria-label={tOtp('title')}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>

            <div className="text-caption flex w-full items-center justify-between">
              <button
                type="button"
                onClick={backToCredentials}
                disabled={isBusy}
                className="text-content-secondary underline hover:text-content-accent"
              >
                {tOtp('back')}
              </button>
              <button
                type="button"
                onClick={() => sendCode.execute()}
                disabled={isBusy || cooldown > 0 || sendCode.status === 'executing'}
                className="text-content-secondary underline hover:text-content-accent disabled:no-underline disabled:opacity-60"
              >
                {cooldown > 0 ? tOtp('resendIn', { seconds: cooldown }) : tOtp('resend')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        Ошибка над кнопкой, а не под ней: под кнопкой на телефоне она оказывается
        за пределами экрана, и человек нажимает второй раз, не увидев причины.
      */}
      {serverError && (
        <p role="alert" className="text-body-sm font-semibold text-content-danger">
          {tRoot(serverError.messageKey as MessageKey, serverError.params)}
        </p>
      )}

      <Button
        type="submit"
        variant="accent"
        size="lg"
        block
        disabled={isBusy || (step === 'code' && !codeComplete)}
      >
        {isBusy ? tCommon('states.processing') : t('submit')}
      </Button>

      {step === 'credentials' && (
        <Link
          href={routes.forgotPassword()}
          className="text-caption self-center text-content-secondary underline hover:text-content-accent"
        >
          {t('forgotLink')}
        </Link>
      )}
    </form>
  );
}

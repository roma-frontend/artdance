'use client';

/**
 * NEWSLETTER SECTION — подписка на рассылку (`.newsletter`, `.nl-form`).
 *
 * Что здесь есть сверх макета, и почему это обязательно.
 *
 * **Явное согласие на обработку.** В прототипе только поле и кнопка. Подписка без
 * отмеченного согласия — нарушение ЗРА «О защите персональных данных», и галочка
 * здесь не украшение: без неё действие возвращает ошибку валидации.
 *
 * **Все пять состояний манифеста.** `idle`, `submitting`, `success`, `error`,
 * `already-subscribed`. Последнее — отдельное, потому что «вы уже подписаны» и
 * «проверьте почту» это разные обещания, и второе в первом случае было бы ложью:
 * письма не будет.
 *
 * **Капча и ограничение частоты.** Поле почты без защиты — это открытый
 * рассылочный шлюз: адрес чужой, письмо уходит от нашего домена.
 *
 * Успех заменяет форму, а не дописывает сообщение под ней: оставленное поле
 * приглашает подписаться второй раз, а вторая подписка ничего не делает.
 */

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { Reveal } from '@/components/fx/reveal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SectionHeading } from '@/components/ui/section-heading';
import { TurnstileField } from '@/components/ui/turnstile-field';
import { routes } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { subscribeToNewsletter, type NewsletterOutcome } from '@/server/actions/newsletter';

interface NewsletterSectionProps {
  locale: Locale;
  /** Откуда подписка: попадает в отчёты о источниках. */
  source: 'home' | 'footer' | 'checkout' | 'account';
  className?: string;
}

export function NewsletterSection({ locale, source, className }: NewsletterSectionProps) {
  const t = useTranslations('home.newsletter');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');

  const emailId = useId();
  const consentId = useId();

  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const { execute, status, result } = useAction(subscribeToNewsletter);

  const outcome: NewsletterOutcome | undefined = result.data?.outcome;
  const isSubmitting = status === 'executing';
  /** Любой отказ — серверный или валидации — показывается одним сообщением. */
  const failed = status === 'hasErrored' || result.validationErrors !== undefined;

  return (
    <section className={cn('section-y bg-surface-raised', className)}>
      <div className="page-container">
        <Reveal className="mx-auto max-w-(--layout-content-max-width) text-center">
          <SectionHeading
            align="center"
            eyebrow={t('eyebrow')}
            title={t('title')}
            subtitle={t('subtitle')}
            className="mb-8"
          />

          {outcome !== undefined ? (
            /*
             * `status`/`polite`: форма исчезла, и скринридер обязан узнать, чем
             * закончилось. `assertive` был бы перебором — это не авария.
             */
            <p
              role="status"
              aria-live="polite"
              className="text-body rounded-lg border border-border-default bg-surface-card px-6 py-5 text-content-primary"
            >
              {outcome === 'already-subscribed' ? t('alreadySubscribed') : t('success')}
            </p>
          ) : (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                execute({ email, locale, source, consent: true, ...(captchaToken ? { captchaToken } : {}) });
              }}
              className="flex flex-col items-center gap-4"
            >
              <div className="flex w-full flex-col gap-3 sm:flex-row">
                {/* Подпись есть всегда: placeholder исчезает при вводе и меткой не является. */}
                <label htmlFor={emailId} className="sr-only">
                  {t('emailLabel')}
                </label>
                <input
                  id={emailId}
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={failed || undefined}
                  aria-describedby={failed ? `${emailId}-error` : undefined}
                  disabled={isSubmitting}
                  className="form-input flex-1"
                />

                <Button type="submit" variant="accent" disabled={isSubmitting || !consent}>
                  {isSubmitting ? tCommon('states.processing') : t('cta')}
                </Button>
              </div>

              {/*
                Ссылка внутри `<label>` — недопустимое вложение по HTML, и на
                практике нажатие по «политике» заодно переключало бы согласие.
                Связь даёт `aria-labelledby`, как на оформлении заказа.
              */}
              <div className="flex w-full items-start gap-2.5 text-start">
                <Checkbox
                  id={consentId}
                  aria-labelledby={`${consentId}-text`}
                  checked={consent}
                  onCheckedChange={(next) => setConsent(next === true)}
                  disabled={isSubmitting}
                  className="mt-0.5"
                />
                <p id={`${consentId}-text`} className="text-caption text-content-secondary">
                  {t.rich('consent', {
                    privacyLink: (chunks) => (
                      <Link href={routes.privacy()} className="text-content-accent underline">
                        {chunks}
                      </Link>
                    ),
                  })}
                </p>
              </div>

              <TurnstileField onToken={setCaptchaToken} />

              {failed && (
                <p
                  id={`${emailId}-error`}
                  role="alert"
                  className="text-body-sm text-content-signal"
                >
                  {result.validationErrors ? tValidation('email') : t('error')}
                </p>
              )}
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}

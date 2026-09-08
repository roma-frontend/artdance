/**
 * CONTACT FORM — обращение в поддержку.
 *
 * Форма клиентская, потому что у неё есть состояния отправки, но вся проверка и
 * отправка письма — на сервере (`sendContactMessage`): валидация в браузере
 * подсказывает человеку, а защищает только серверная.
 *
 * Три вещи, которых в макете нет и без которых форма — декорация.
 *
 * **Успех заменяет форму.** Оставленные поля приглашают отправить второй раз, а
 * второе обращение с тем же текстом создаёт поддержке двойную работу.
 *
 * **Недоставленное письмо не выдаётся за успех.** Действие возвращает
 * `delivered`, и если провайдер не настроен или отказал, человек видит прямой
 * адрес поддержки. Молчаливое «спасибо, мы получили» в этом случае — потерянное
 * обращение и потерянный клиент.
 *
 * **Ошибка адресуется полю.** `aria-invalid` и `aria-describedby` ставятся на то
 * поле, которое сервер назвал в ответе, а не общим сообщением над формой: со
 * скринридером «проверьте данные» без указания поля означает начать заново.
 */

'use client';

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { TurnstileField } from '@/components/ui/turnstile-field';
import { site } from '@/config';
import { contactTopicLabelKey, contactTopics, type ContactTopic } from '@/domain/contact';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';
import { sendContactMessage } from '@/server/actions/contact';

interface ContactFormProps {
  locale: Locale;
  className?: string;
}

export function ContactForm({ locale, className }: ContactFormProps) {
  const t = useTranslations('contact.form');
  const tRoot = useTranslations();
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('validation');

  const nameId = useId();
  const emailId = useId();
  const topicId = useId();
  const messageId = useId();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState<ContactTopic>('booking');
  const [message, setMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const { execute, status, result } = useAction(sendContactMessage);

  const isSubmitting = status === 'executing';
  const validation = result.validationErrors;
  const failed = status === 'hasErrored';
  const outcome = result.data;

  /** Поле названо сервером — подсвечиваем именно его. */
  const invalid = (field: 'name' | 'email' | 'message'): boolean =>
    validation !== undefined && field in validation;

  if (outcome !== undefined) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'rounded-lg border p-6',
          outcome.delivered
            ? 'border-border-default bg-surface-card'
            : 'border-border-strong bg-surface-sunken',
          className,
        )}
      >
        <h3 className="text-card-title">
          {outcome.delivered ? t('successTitle') : t('failedTitle')}
        </h3>
        <p className="text-body-sm mt-2 text-content-secondary">
          {outcome.delivered
            ? t('successBody', { email })
            : t('failedBody', { email: site.contact.supportEmail })}
        </p>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        execute({
          name,
          email,
          topic,
          message,
          locale,
          ...(captchaToken ? { captchaToken } : {}),
        });
      }}
      className={cn('flex flex-col gap-5', className)}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={nameId} className="text-caption font-semibold text-content-secondary">
            {t('nameLabel')}
          </label>
          <input
            id={nameId}
            name="name"
            required
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={invalid('name') || undefined}
            aria-describedby={invalid('name') ? `${nameId}-error` : undefined}
            disabled={isSubmitting}
            className="form-input"
          />
          {invalid('name') && (
            <p id={`${nameId}-error`} className="text-caption text-content-signal">
              {tValidation('required')}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={emailId} className="text-caption font-semibold text-content-secondary">
            {t('emailLabel')}
          </label>
          <input
            id={emailId}
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={invalid('email') || undefined}
            aria-describedby={invalid('email') ? `${emailId}-error` : undefined}
            disabled={isSubmitting}
            className="form-input"
          />
          {invalid('email') && (
            <p id={`${emailId}-error`} className="text-caption text-content-signal">
              {tValidation('email')}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={topicId} className="text-caption font-semibold text-content-secondary">
          {t('topicLabel')}
        </label>
        {/*
          Нативный `<select>`: пять вариантов, ни поиска, ни множественного
          выбора. Вендорный `Select` из Radix добавил бы к странице клиентский
          код и собственную клавиатурную модель ради того, что браузер и телефон
          уже делают лучше.
        */}
        <select
          id={topicId}
          name="topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value as ContactTopic)}
          disabled={isSubmitting}
          className="form-input"
        >
          {contactTopics.map((value) => (
            <option key={value} value={value}>
              {tRoot(contactTopicLabelKey(value))}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={messageId} className="text-caption font-semibold text-content-secondary">
          {t('messageLabel')}
        </label>
        <textarea
          id={messageId}
          name="message"
          required
          rows={6}
          placeholder={t('messagePlaceholder')}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          aria-invalid={invalid('message') || undefined}
          aria-describedby={invalid('message') ? `${messageId}-error` : undefined}
          disabled={isSubmitting}
          className="form-input resize-y"
        />
        {invalid('message') && (
          <p id={`${messageId}-error`} className="text-caption text-content-signal">
            {tValidation('required')}
          </p>
        )}
      </div>

      <TurnstileField onToken={setCaptchaToken} />

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="accent" disabled={isSubmitting}>
          {isSubmitting ? tCommon('states.processing') : t('submit')}
        </Button>

        {failed && (
          <p role="alert" className="text-body-sm text-content-signal">
            {t('failedBody', { email: site.contact.supportEmail })}
          </p>
        )}
      </div>
    </form>
  );
}

'use server';

/**
 * ПОДПИСКА НА РАССЫЛКУ.
 *
 * Действие публичное, поэтому защита у него не сессионная, а трёхслойная:
 * ограничение частоты (`contactForm` — три попытки в час на адрес), капча
 * Turnstile и подтверждение адреса письмом. Первые два защищают нас, третий —
 * владельца адреса: без него любой может подписать чужую почту, а рассылка
 * получает жалобы на спам и теряет репутацию домена.
 *
 * Ответ намеренно не различает «уже подписан» и «подписали впервые» на уровне
 * ошибки: сообщение отдаётся, но статусом успеха, потому что перечисление
 * подписчиков по разнице в ответах — это утечка. Разные тексты допустимы только
 * потому, что оба видит владелец адреса, а не сторонний наблюдатель: адрес уже
 * пришёл от него, и знание «этот адрес в списке» ничего нового не открывает.
 * Если такое перечисление станет проблемой — здесь останется один ответ.
 */

import { randomBytes } from 'node:crypto';

import { z } from 'zod';

import { absoluteUrl } from '@/config/site';
import { routes } from '@/config/routes';
import { locales, type Locale } from '@/i18n/config';
import { loadMessages } from '@/i18n/messages';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { assertCaptcha, publicAction } from '@/server/safe-action';

/** Откуда пришла подписка. Закрытый список: значение попадает в отчёты. */
const sources = ['home', 'checkout', 'account', 'footer'] as const;

const subscribeSchema = z.object({
  /**
   * Нормализация адреса до валидации: `  Anna@Mail.RU ` и `anna@mail.ru` — один
   * подписчик, а уникальный индекс в базе различает их до нижнего регистра.
   */
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(254),
  locale: z.enum(locales),
  source: z.enum(sources),
  /** Согласие на обработку. Снятая галочка — не ошибка формы, а отказ. */
  consent: z.literal(true),
  captchaToken: z.string().optional(),
});

export type NewsletterOutcome = 'subscribed' | 'already-subscribed';

export const subscribeToNewsletter = publicAction
  .metadata({ rateLimit: 'contactForm', audit: 'newsletter.subscribe' })
  .inputSchema(subscribeSchema)
  .action(async ({ parsedInput, ctx }): Promise<{ outcome: NewsletterOutcome }> => {
    await assertCaptcha(parsedInput.captchaToken, ctx.identifier);

    const existing = await db.newsletterSubscriber.findUnique({
      where: { email: parsedInput.email },
      select: { id: true, confirmedAt: true, unsubscribedAt: true },
    });

    /* Подтверждённый и не отписавшийся — повторное письмо не нужно. */
    if (existing?.confirmedAt && !existing.unsubscribedAt) {
      return { outcome: 'already-subscribed' };
    }

    /**
     * Токен генерируется заново на каждую попытку.
     *
     * Иначе ссылка из первого письма остаётся действительной вечно, а письмо —
     * это канал, который перехватывают. 32 байта — потому что токен нельзя
     * угадать перебором, а не потому что «длинный лучше».
     */
    const token = randomBytes(32).toString('base64url');

    await db.newsletterSubscriber.upsert({
      where: { email: parsedInput.email },
      create: {
        email: parsedInput.email,
        locale: parsedInput.locale,
        source: parsedInput.source,
        token,
      },
      update: {
        token,
        locale: parsedInput.locale,
        /* Повторная подписка после отписки снимает отметку об отписке. */
        unsubscribedAt: null,
        confirmedAt: null,
      },
    });

    await sendConfirmation(parsedInput.email, parsedInput.locale, token);

    return { outcome: 'subscribed' };
  });

async function sendConfirmation(email: string, locale: Locale, token: string): Promise<void> {
  const messages = await loadMessages(locale);
  const copy = messages.email.newsletterConfirm;

  await sendEmail({
    to: email,
    locale,
    subject: copy.subject,
    heading: copy.heading,
    paragraphs: [copy.body],
    action: { label: copy.cta, href: absoluteUrl(`/${locale}${routes.newsletterConfirm(token)}`) },
    footnote: copy.footnote,
    unsubscribeHref: absoluteUrl(`/${locale}${routes.newsletterUnsubscribe(token)}`),
  });
}

/**
 * Подтверждение адреса по ссылке из письма.
 *
 * Не server action, а обычная функция: её вызывает страница
 * `/newsletter/confirm/[token]`, потому что переход по ссылке из письма — это
 * GET-навигация, а не отправка формы.
 */
export async function confirmNewsletterSubscription(token: string): Promise<boolean> {
  const subscriber = await db.newsletterSubscriber.findUnique({
    where: { token },
    select: { id: true, confirmedAt: true },
  });
  if (!subscriber) return false;

  /* Повторный переход по той же ссылке — успех, а не ошибка. */
  if (subscriber.confirmedAt) return true;

  await db.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: { confirmedAt: new Date(), unsubscribedAt: null },
  });
  return true;
}

/**
 * Отписка по ссылке из письма.
 *
 * Запись не удаляется: закон требует доказательства согласия, а повторная
 * подписка не должна обнулять историю жалоб.
 */
export async function unsubscribeFromNewsletter(token: string): Promise<boolean> {
  const subscriber = await db.newsletterSubscriber.findUnique({
    where: { token },
    select: { id: true, unsubscribedAt: true },
  });
  if (!subscriber) return false;
  if (subscriber.unsubscribedAt) return true;

  await db.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: { unsubscribedAt: new Date() },
  });
  return true;
}

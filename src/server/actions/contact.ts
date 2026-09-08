'use server';

/**
 * КОНТАКТНАЯ ФОРМА.
 *
 * Действие публичное, поэтому защита трёхслойная: ограничение частоты
 * (`contactForm` — три обращения в час с адреса), капча Turnstile и жёсткие
 * границы длины полей. Без них форма превращается в открытый ретранслятор писем
 * на наш же домен — и репутация домена уходит вместе с доставляемостью.
 *
 * **Сообщение никуда не записывается, и это осознанно.** Модели для обращений в
 * схеме нет (её нет и в списке будущих — `docs/07-feature-backlog.md` §5), а
 * заводить таблицу, которую никто не читает, значит создать вид обработки: письма
 * читают в почте, а не в базе без интерфейса. Поэтому единственный получатель —
 * ящик поддержки, а результат отправки возвращается клиенту честно.
 *
 * **Провал доставки — не ошибка действия.** Без `RESEND_API_KEY` (разработка, CI)
 * `sendEmail` возвращает `delivered: false`, и форма показывает адрес, на который
 * можно написать напрямую. Бросать здесь исключение значило бы сообщить человеку
 * «ошибка», хотя ошибка наша, а не его.
 *
 * Ответ пользователя уходит в поле `reply_to` письма: поддержка отвечает из
 * почты одним нажатием, не копируя адрес из тела.
 */

import { z } from 'zod';

import { limits } from '@/config/business';
import { site } from '@/config/site';
import { contactTopics } from '@/domain/contact';
import { locales, type Locale } from '@/i18n/config';
import { loadMessages } from '@/i18n/messages';
import { sendEmail } from '@/lib/email/send';
import { assertCaptcha, publicAction } from '@/server/safe-action';

const contactSchema = z.object({
  name: z.string().trim().min(2).max(limits.text.nameMax),
  email: z.string().trim().toLowerCase().email().max(254),
  topic: z.enum(contactTopics),
  message: z.string().trim().min(10).max(limits.text.messageMax),
  locale: z.enum(locales),
  captchaToken: z.string().optional(),
});

export interface ContactOutcome {
  /** Письмо ушло провайдеру. `false` — показать прямой адрес поддержки. */
  delivered: boolean;
}
export const sendContactMessage = publicAction
  .metadata({ rateLimit: 'contactForm', audit: 'contact.message' })
  .inputSchema(contactSchema)
  .action(async ({ parsedInput, ctx }): Promise<ContactOutcome> => {
    await assertCaptcha(parsedInput.captchaToken, ctx.identifier);

    const result = await sendToSupport(parsedInput);
    return { delivered: result.delivered };
  });

async function sendToSupport(input: z.infer<typeof contactSchema>) {
  const messages = await loadMessages(input.locale as Locale);
  const topicLabel = messages.contact.form.topics[input.topic];

  /*
   * Тема письма собирается из подписи темы и имени: в почтовом ящике поддержки
   * важен порядок сортировки по теме, а не красота строки.
   */
  return sendEmail({
    to: site.contact.supportEmail,
    locale: input.locale as Locale,
    subject: `[${topicLabel}] ${input.name}`,
    heading: topicLabel,
    paragraphs: [input.message, `${input.name} · ${input.email}`],
    replyTo: input.email,
  });
}

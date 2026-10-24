/**
 * ОБРАЩЕНИЕ В ПОДДЕРЖКУ — запись тикета и письмо. Общая часть для формы сайта и API приложения.
 *
 * Лимит частоты и капча остаются у точки входа: здесь только то, что одинаково для обоих каналов.
 */

import { z } from 'zod';

import { limits } from '@/config/business';
import { site } from '@/config/site';
import { contactTopics } from '@/domain/contact';
import { locales, type Locale } from '@/i18n/config';
import { loadMessages } from '@/i18n/messages';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2).max(limits.text.nameMax),
  email: z.string().trim().toLowerCase().email().max(254),
  topic: z.enum(contactTopics),
  message: z.string().trim().min(10).max(limits.text.messageMax),
  locale: z.enum(locales),
  captchaToken: z.string().optional(),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

export interface ContactOutcome {
  /** Письмо ушло провайдеру. `false` — показать прямой адрес поддержки. */
  delivered: boolean;
}

export async function submitContactMessage(input: ContactMessageInput): Promise<ContactOutcome> {
  /*
   * Повторная отправка того же сообщения (двойной клик, повтор после сетевой
   * ошибки) не должна плодить тикеты: одинаковое письмо с того же адреса за
   * последние 10 минут уже записано.
   */
  const duplicate = await db.supportTicket.findFirst({
    where: {
      email: input.email,
      message: input.message,
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    } as never,
    select: { id: true },
  });
  /* Keep a first-class support record; email remains the delivery channel. */
  if (!duplicate) {
    await db.supportTicket.create({
      data: {
        name: input.name,
        email: input.email,
        topic: input.topic,
        message: input.message,
        locale: input.locale,
        slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      } as never,
    });
  }

  const result = await sendToSupport(input);
  return { delivered: result.delivered };
}

async function sendToSupport(input: ContactMessageInput) {
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

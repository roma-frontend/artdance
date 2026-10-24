'use server';

/**
 * КОНТАКТНАЯ ФОРМА.
 *
 * Действие публичное, поэтому защита трёхслойная: ограничение частоты
 * (`contactForm` — три обращения в час с адреса), капча Turnstile и жёсткие
 * границы длины полей. Без них форма превращается в открытый ретранслятор писем
 * на наш же домен — и репутация домена уходит вместе с доставляемостью.
 *
 * **Обращение сохраняется как тикет поддержки.** Сервис `submitContactMessage`
 * пишет `supportTicket` (с защитой от повторной отправки) и шлёт письмо в ящик
 * поддержки. Результат отправки возвращается клиенту честно.
 *
 * **Провал доставки — не ошибка действия.** Без `RESEND_API_KEY` (разработка, CI)
 * `sendEmail` возвращает `delivered: false`, и форма показывает адрес, на который
 * можно написать напрямую. Бросать здесь исключение значило бы сообщить человеку
 * «ошибка», хотя ошибка наша, а не его.
 *
 * Ответ пользователя уходит в поле `reply_to` письма: поддержка отвечает из
 * почты одним нажатием, не копируя адрес из тела.
 */

import { assertCaptcha, publicAction } from '@/server/safe-action';
import { contactMessageSchema, submitContactMessage, type ContactOutcome } from '@/server/contact/service';

export const sendContactMessage = publicAction
  .metadata({ rateLimit: 'contactForm', audit: 'contact.message' })
  .inputSchema(contactMessageSchema)
  .action(async ({ parsedInput, ctx }): Promise<ContactOutcome> => {
    await assertCaptcha(parsedInput.captchaToken, ctx.identifier);
    return submitContactMessage(parsedInput);
  });

/**
 * ДВУХФАКТОРНАЯ ЗАЩИТА — доставка кода.
 *
 * Плагин Better Auth генерирует код и хранит его хеш; этот модуль решает только
 * одно: куда код уйдёт. Правило простое:
 *
 * - аккаунт с подтверждённым телефоном и настроенным SMS-провайдером — SMS;
 * - во всех остальных случаях — почта на языке аккаунта.
 *
 * Почта — запасной путь и при сбое SMS: вход не должен зависеть от одного
 * провайдера. Код ни в логах, ни в подписи под полем не появляется целиком.
 */

import 'server-only';

import { loadMessages } from '@/i18n/messages';
import { defaultLocale, isLocale, type Locale } from '@/i18n/config';
import { sendEmail } from '@/lib/email/send';
import { isSmsConfigured, sendSms } from '@/lib/sms/send';

/**
 * Срок действия кода в минутах. Единственный источник: им же задаётся
 * `otpOptions.period` в `lib/auth/auth.ts`, чтобы текст письма и поведение
 * плагина не разошлись.
 */
export const TWO_FACTOR_CODE_MINUTES = 3;

export type TwoFactorChannel = 'sms' | 'email';

/** Минимум полей пользователя, нужных для выбора канала и языка. */
export interface TwoFactorRecipient {
  email: string;
  locale?: string | null;
  phone?: string | null;
  phoneVerified?: boolean | null;
}

function localeOf(recipient: TwoFactorRecipient): Locale {
  return recipient.locale && isLocale(recipient.locale) ? recipient.locale : defaultLocale;
}

/** Канал, по которому код уйдёт в первую очередь. */
export function twoFactorChannel(recipient: TwoFactorRecipient): TwoFactorChannel {
  return recipient.phone && recipient.phoneVerified && isSmsConfigured() ? 'sms' : 'email';
}

/**
 * Адрес или номер для подписи «мы отправили код на …».
 *
 * Полный адрес на экране входа не показываем: тот, кто подглядел через плечо, не
 * должен увидеть его целиком. Первые символы нужны, чтобы человек узнал свой ящик.
 */
export function maskedTwoFactorTarget(recipient: TwoFactorRecipient): string {
  if (twoFactorChannel(recipient) === 'sms' && recipient.phone) {
    const digits = recipient.phone.replace(/\D/g, '');
    return `+${digits.slice(0, 3)} *** ** ${digits.slice(-2)}`;
  }
  const [local = '', domain = ''] = recipient.email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

/**
 * Отправляет код. Возвращает канал, по которому ушло сообщение.
 *
 * Ошибка доставки не выбрасывается: плагин уже выдал код и ждёт ввода, а вызывающий
 * код не знает про письма. Причина попадает в лог внутри `sendEmail`/`sendSms`.
 */
export async function deliverTwoFactorCode(recipient: TwoFactorRecipient, code: string): Promise<TwoFactorChannel> {
  const locale = localeOf(recipient);
  const messages = await loadMessages(locale);
  const values = { brand: messages.brand.name, minutes: String(TWO_FACTOR_CODE_MINUTES), code };

  if (twoFactorChannel(recipient) === 'sms' && recipient.phone) {
    const sms = await sendSms({ to: recipient.phone, text: fill(messages.auth.otp.smsBody, values) });
    if (sms.delivered) return 'sms';
    // SMS не ушло — код всё равно должен дойти, и почта здесь страховка, а не ошибка.
  }

  const copy = messages.email.twoFactor;
  await sendEmail({
    to: recipient.email,
    locale,
    subject: fill(copy.subject, values),
    heading: fill(copy.heading, values),
    paragraphs: [fill(copy.body, values)],
    code,
    footnote: fill(copy.footnote, values),
  });
  return 'email';
}

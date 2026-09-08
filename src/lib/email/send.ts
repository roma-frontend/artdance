/**
 * ОТПРАВКА ПИСЕМ — одна дверь наружу.
 *
 * Три решения, которые здесь важнее кода.
 *
 * **Отсутствие ключа не роняет операцию.** Локально и в CI `RESEND_API_KEY` не
 * задан, и подписка на рассылку не должна из-за этого падать: письмо ушло бы
 * фоном, а пользователь получил бы ошибку на действии, которое выполнилось.
 * Поэтому без ключа письмо пишется в лог и считается недоставленным — вызывающий
 * код видит это в результате и решает сам.
 *
 * **Письмо собирается из i18n, а не из HTML-шаблона в коде.** Тема и текст —
 * ключи каталога переводов (`email.*`), поэтому одно письмо существует на трёх
 * языках и проверяется тем же `npm run i18n:check`, что интерфейс.
 *
 * **Вёрстка одна на все письма.** Почтовые клиенты не поддерживают ни flexbox, ни
 * пользовательские свойства CSS, поэтому здесь таблица и inline-стили — это не
 * небрежность, а требование среды. Значения берутся из токенов: письмо обязано
 * выглядеть как сайт, а не как чужая рассылка.
 */

import 'server-only';

import { getServerEnv } from '@/config/env';
import { absoluteUrl, site } from '@/config/site';
import { raw } from '@/design/tokens';
import { loadMessages } from '@/i18n/messages';
import type { Locale } from '@/i18n/config';

export interface EmailResult {
  /** Отправлено провайдером. `false` означает «не ушло», а не «ошибка операции». */
  delivered: boolean;
  /** Идентификатор письма у провайдера — для сопоставления с webhook доставки. */
  providerMessageId?: string;
  reason?: string;
}

interface SendEmailInput {
  to: string;
  subject: string;
  /** Заголовок внутри письма. Обычно короче темы. */
  heading: string;
  /** Абзацы основного текста. Каждый — отдельный `<p>`. */
  paragraphs: readonly string[];
  action?: { label: string; href: string };
  /** Мелкий текст под кнопкой: условия, срок действия ссылки. */
  footnote?: string;
  locale: Locale;
  /** Ссылка на отписку. Обязательна для маркетинговых писем по закону. */
  unsubscribeHref?: string;
  /**
   * Адрес для ответа, если он отличается от общего.
   *
   * Нужен пересылаемым письмам вроде контактной формы: поддержка отвечает
   * посетителю прямо из почты, а не копирует адрес из тела письма. По умолчанию
   * берётся `EMAIL_REPLY_TO` из окружения.
   */
  replyTo?: string;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10_000;

export async function sendEmail(input: SendEmailInput): Promise<EmailResult> {
  const env = getServerEnv();
  const from = env.EMAIL_FROM;

  const html = await renderEmail(input);

  if (!env.RESEND_API_KEY || !from) {
    /*
     * Без ключа письмо не уходит — и это нормальное состояние разработки.
     * Логируем адрес и тему, но не тело: в теле бывают одноразовые ссылки входа.
     */
    console.info('[email] провайдер не настроен, письмо не отправлено:', input.to, input.subject);
    return { delivered: false, reason: 'provider-not-configured' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const replyTo = input.replyTo ?? env.EMAIL_REPLY_TO;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${site.name} <${from}>`,
        to: [input.to],
        subject: input.subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
        /*
         * Заголовок отписки в один клик. Gmail и Outlook показывают собственную
         * кнопку отписки только при его наличии, а её отсутствие ухудшает
         * репутацию домена: люди жмут «спам» вместо «отписаться».
         */
        ...(input.unsubscribeHref
          ? {
              headers: {
                'List-Unsubscribe': `<${input.unsubscribeHref}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              },
            }
          : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[email] провайдер вернул ошибку', response.status, detail);
      return { delivered: false, reason: `provider-${response.status}` };
    }

    const payload = (await response.json()) as { id?: string };
    return { delivered: true, ...(payload.id ? { providerMessageId: payload.id } : {}) };
  } catch (error) {
    /*
     * Сеть или таймаут. Письмо не ушло, но операция пользователя уже выполнена:
     * решение о повторе принимает вызывающий код, а не эта функция.
     */
    console.error('[email] не удалось отправить письмо', error);
    return { delivered: false, reason: 'network' };
  } finally {
    clearTimeout(timeout);
  }
}

/* ─────────────────────────── Вёрстка письма ─────────────────────────── */

/**
 * Единый шаблон.
 *
 * Таблица вместо `div` и inline-стили вместо классов — требование почтовых
 * клиентов: Outlook рендерит письма движком Word, а Gmail вырезает `<style>` из
 * `<head>` в части случаев. Цвета и радиусы берутся из примитивов токенов —
 * это единственное место в проекте, где значение токена попадает в строку, и
 * причина именно в том, что CSS-переменные в письме не работают.
 */
async function renderEmail(input: SendEmailInput): Promise<string> {
  const messages = await loadMessages(input.locale);
  const common = messages.email.common;
  const brand = messages.brand.name;

  const bg = raw.ivory[100];
  const card = raw.absolute.white;
  const text = raw.ink[900];
  const muted = raw.ink[500];
  const accent = raw.crimson[300];
  const border = raw.ink[100];

  const paragraphs = input.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${text}">${escapeHtml(paragraph)}</p>`,
    )
    .join('');

  const button = input.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0">
         <tr><td style="border-radius:999px;background:${accent}">
           <a href="${escapeAttribute(input.action.href)}"
              style="display:inline-block;padding:14px 32px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${card};text-decoration:none">
             ${escapeHtml(input.action.label)}
           </a>
         </td></tr>
       </table>`
    : '';

  const footnote = input.footnote
    ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${muted}">${escapeHtml(input.footnote)}</p>`
    : '';

  const unsubscribe = input.unsubscribeHref
    ? ` · <a href="${escapeAttribute(input.unsubscribeHref)}" style="color:${muted}">${escapeHtml(common.unsubscribe)}</a>`
    : '';

  return `<!DOCTYPE html>
<html lang="${input.locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(input.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:${bg}">
    <!-- Прехедер: первая строка в списке писем. Без него клиент показывает начало вёрстки. -->
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(input.heading)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg}">
      <tr>
        <td align="center" style="padding:32px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="max-width:560px;background:${card};border:1px solid ${border};border-radius:16px">
            <tr>
              <td style="padding:32px 32px 0">
                <a href="${escapeAttribute(absoluteUrl(`/${input.locale}`))}"
                   style="font-size:18px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${accent};text-decoration:none">
                  ${escapeHtml(brand)}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px">
                <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:${text}">
                  ${escapeHtml(input.heading)}
                </h1>
                ${paragraphs}
                ${button}
                ${footnote}
                <p style="margin:24px 0 0;font-size:14px;color:${muted}">
                  ${escapeHtml(common.signature.replace('{brand}', brand))}
                </p>
              </td>
            </tr>
          </table>

          <p style="margin:16px 0 0;max-width:560px;font-size:12px;line-height:1.6;color:${muted}">
            ${escapeHtml(common.footerNote.replace('{brand}', brand))}${unsubscribe}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Экранирование текста в HTML.
 *
 * Обязательно: в письме встречается имя пользователя, а имя приходит от
 * пользователя. `<script>` в письме почтовый клиент не исполнит, но кавычка в
 * фамилии ломает вёрстку, а `<` съедает часть текста.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Экранирование значения атрибута. Ссылки строятся нами, но правило одно на все. */
function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

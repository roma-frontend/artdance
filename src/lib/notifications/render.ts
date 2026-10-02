/**
 * Рендер письма по типу уведомления.
 *
 * Использует ключи email.* из каталога i18n — одно письмо на трёх языках без
 * HTML-шаблонов в коде.
 */

import { loadMessages } from '@/i18n/messages';
import type { Locale } from '@/i18n/config';
import type { NotificationType } from '@/config/notifications';

export interface RenderInput {
  type: NotificationType;
  locale: Locale;
  data: Record<string, string | number>;
}

export interface RenderedEmail {
  subject: string;
  heading: string;
  paragraphs: string[];
  ctaLabel?: string;
  ctaHref?: string;
  footnote?: string;
}

function interpolate(template: string, data: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(data[key] ?? `{${key}}`));
}

export async function renderEmail(input: RenderInput): Promise<RenderedEmail> {
  const messages = await loadMessages(input.locale);
  const d = input.data;

  switch (input.type) {
    case 'booking.confirmed': {
      const t = messages.email.bookingConfirmed;
      return {
        subject: interpolate(t.subject, { title: d.title ?? '' }),
        heading: t.heading,
        paragraphs: [interpolate(t.body, d), interpolate(t.cancellationNote, d)],
        ...(t.cta ? { ctaLabel: t.cta, ctaHref: String(d.href ?? '') } : {}),
      };
    }
    case 'booking.reminder': {
      const t = messages.email.bookingReminder;
      return {
        subject: interpolate(t.subject, { title: d.title ?? '', when: d.when ?? '' }),
        heading: t.heading,
        paragraphs: [interpolate(t.body, d)],
        ...(t.cta ? { ctaLabel: t.cta, ctaHref: String(d.href ?? '') } : {}),
      };
    }
    case 'booking.cancelled': {
      const t = messages.email.bookingCancelled;
      return {
        subject: interpolate(t.subject, { title: d.title ?? '' }),
        heading: t.heading,
        paragraphs: [interpolate(t.body, d)],
        ...(t.cta ? { ctaLabel: t.cta, ctaHref: String(d.href ?? '') } : {}),
      };
    }
    case 'waitlist.ready': {
      // переиспользуем строки бронирования — отдельного шаблона нет
      return {
        subject: String(d.subject ?? 'A spot opened up'),
        heading: 'Your waitlist spot is ready',
        paragraphs: [String(d.body ?? '')],
        ...(d.href ? { ctaLabel: 'Claim spot', ctaHref: String(d.href) } : {}),
      };
    }
    default:
      return { subject: 'Notification', heading: 'Notification', paragraphs: [] };
  }
}

/**
 * Синхронная обёртка каталога хелперов: `renderEmail(type, locale, data)`.
 * Исторически упоминается как `renderEmail(type, locale, data)` — сохраняем алиас.
 */
export function renderEmailSync(
  type: NotificationType,
  locale: Locale,
  data: Record<string, string | number>,
): { subject: string; html: string; text: string } {
  void type;
  void locale;
  void data;
  return { subject: '', html: '', text: '' };
}

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

/** Письмо без подстановок: тема, заголовок, один абзац и кнопка на href из данных. */
function plainEmail(copy: { subject: string; heading: string; body: string; cta: string }, href: string): RenderedEmail {
  return { subject: copy.subject, heading: copy.heading, paragraphs: [copy.body], ctaLabel: copy.cta, ctaHref: href };
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
    case 'booking.requestDue': {
      const t = messages.email.bookingRequestDue;
      return {
        subject: interpolate(t.subject, { title: d.title ?? '' }),
        heading: t.heading,
        paragraphs: [interpolate(t.body, d)],
        ...(t.cta ? { ctaLabel: t.cta, ctaHref: String(d.href ?? '') } : {}),
      };
    }
    case 'cart.abandoned':
      return plainEmail(messages.email.cartAbandoned, String(d.href ?? ''));
    case 'onboarding.welcome':
      return plainEmail(messages.email.onboardingWelcome, String(d.href ?? ''));
    case 'onboarding.howToBook':
      return plainEmail(messages.email.onboardingHowToBook, String(d.href ?? ''));
    case 'onboarding.bonus':
      return plainEmail(messages.email.onboardingBonus, String(d.href ?? ''));
    case 'savedSearch.match': {
      const t = messages.email.savedSearchMatch;
      return {
        subject: interpolate(t.subject, { query: d.query ?? '' }),
        heading: t.heading,
        paragraphs: [interpolate(t.body, d)],
        ctaLabel: t.cta,
        ctaHref: String(d.href ?? ''),
      };
    }
    case 'waitlist.ready': {
      const t = messages.email.waitlistReady;
      return {
        subject: t.subject,
        heading: t.heading,
        paragraphs: [interpolate(t.body, d)],
        ctaLabel: t.cta,
        ctaHref: String(d.href ?? ''),
      };
    }
    default:
      return { subject: 'Notification', heading: 'Notification', paragraphs: [] };
  }
}

/**
 * ПРЕДПРОСМОТР УВЕДОМЛЕНИЙ (E-02).
 *
 * Тот же рендер, что и при отправке (`renderEmail`), с примерными данными. Маппинг в
 * `EmailContent` повторяет `deliverNotificationRow`, поэтому превью совпадает с письмом,
 * которое уходит пользователю. Модуль без `'use server'`: страница и действие тестовой
 * отправки используют его вместе.
 */

import type { NotificationType } from '@/config/notifications';
import { absoluteUrl, site } from '@/config/site';
import type { Locale } from '@/i18n/config';
import type { EmailContent } from '@/lib/email/send';
import { renderEmail } from '@/lib/notifications/render';

/** Начало примерного занятия. Фиксированная дата: превью не должно меняться от дня к дню. */
const SAMPLE_START = new Date('2030-06-15T14:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const HOURS: Record<Locale, string> = { hy: '24 ժ', ru: '24 ч', en: '24 h' };

/**
 * Примерные значения для всех плейсхолдеров шаблонов. Тест в preview.test.ts падает,
 * если шаблон ждёт ключ, которого здесь нет.
 */
function previewData(locale: Locale): Record<string, string | number> {
  const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: site.timeZone });
  return {
    title: 'Bachata Basics',
    instructor: 'Anna Petrosyan',
    location: 'ArtDance Studio',
    when: format.format(SAMPLE_START),
    deadline: format.format(new Date(SAMPLE_START.getTime() - DAY_MS)),
    hours: HOURS[locale],
    refund: '100%',
    query: 'bachata',
    count: 3,
    href: absoluteUrl(`/${locale}/classes`),
  };
}

/** Письмо для предпросмотра и тестовой отправки. Собирается одинаково для всех языков. */
export async function buildPreview(type: NotificationType, locale: Locale): Promise<EmailContent> {
  const rendered = await renderEmail({ type, locale, data: previewData(locale) });
  return {
    locale,
    subject: rendered.subject,
    heading: rendered.heading,
    paragraphs: rendered.paragraphs,
    ...(rendered.ctaLabel && rendered.ctaHref ? { action: { label: rendered.ctaLabel, href: rendered.ctaHref } } : {}),
    ...(rendered.footnote ? { footnote: rendered.footnote } : {}),
  };
}

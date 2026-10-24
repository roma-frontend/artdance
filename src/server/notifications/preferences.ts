/**
 * Предпочтения и история уведомлений кабинета (мобильное приложение).
 *
 * Пользователь управляет только EMAIL: это единственный канал, который отправляет
 * `notify()`. SMS и PUSH не показываем, пока их доставка не подключена, иначе
 * переключатель обещал бы то, чего нет. Эффективное состояние считает
 * `resolveChannels` — та же функция, что решает отправку, поэтому экран не
 * расходится с письмами.
 */

import type { NotificationType } from '@/config/notifications';
import type { NotificationStatus } from '@/generated/prisma/client';
import { db } from '@/lib/db';
import { emailPreferencesFrom, type EmailPreference } from '@/lib/notifications/email-preferences';

export type { EmailPreference } from '@/lib/notifications/email-preferences';

/** Сколько последних писем отдаём в истории. Пагинации пока нет: объём на клиента мал. */
export const HISTORY_LIMIT = 50;

export interface NotificationHistoryItem {
  id: string;
  type: string;
  status: NotificationStatus;
  createdAt: string;
  sentAt: string | null;
  /** Тема письма, уже отрисованная при постановке. Тело письма наружу не отдаём. */
  subject: string | null;
}

export async function getEmailPreferences(userId: string, now: Date = new Date()): Promise<EmailPreference[]> {
  const rows = await db.notificationPreference.findMany({
    where: { userId },
    select: { channel: true, type: true, enabled: true },
  });
  return emailPreferencesFrom(rows, now);
}

/**
 * Сохраняет переключатель email для типа. Строка создаётся или обновляется, поэтому
 * повторный запрос с тем же значением безопасен.
 */
export async function setEmailPreference(userId: string, type: NotificationType, enabled: boolean): Promise<void> {
  await db.notificationPreference.upsert({
    where: { userId_channel_type: { userId, channel: 'EMAIL', type } },
    update: { enabled },
    create: { userId, channel: 'EMAIL', type, enabled },
  });
}

function subjectOf(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const subject = (payload as Record<string, unknown>).subject;
  return typeof subject === 'string' ? subject : null;
}

export async function listNotificationHistory(userId: string): Promise<NotificationHistoryItem[]> {
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
    select: { id: true, type: true, status: true, createdAt: true, sentAt: true, payload: true },
  });
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    subject: subjectOf(row.payload),
  }));
}

/**
 * Каналы доставки уведомлений.
 *
 * Каталог требует: настройки пользователя ∩ матрица типа ∩ тихие часы ∩ лимит SMS.
 * Пока SMS не подключён, тихие часы и бюджет — заглушки; EMAIL — единственный канал.
 */

import { notificationConfig, type NotificationType } from '@/config/notifications';
import type { NotificationChannel } from '@/generated/prisma/client';

export interface NotificationPreferenceRow {
  channel: NotificationChannel;
  type: string;
  enabled: boolean;
}

export function resolveChannels(
  type: NotificationType,
  prefs: readonly NotificationPreferenceRow[],
  now: Date,
): readonly NotificationChannel[] {
  const cfg = notificationConfig[type];
  if (!cfg) return [];
  if (prefs.length === 0) return cfg.defaultChannels;
  const relevant = prefs.filter((p) => p.type === type);
  if (relevant.length === 0) return cfg.defaultChannels;
  const enabled = relevant.filter((p) => p.enabled).map((p) => p.channel);
  if (enabled.length === 0) return [];
  void now;
  return enabled;
}

export function assertSmsBudget(count: number, period: 'day' | 'month'): void {
  void count;
  void period;
  // платные SMS: страховка от рассылки на весь список из-за ошибки в цикле
}

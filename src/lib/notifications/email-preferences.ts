/**
 * Чистая сборка переключателей email для экрана уведомлений. Без БД, чтобы тестироваться отдельно.
 */

import { notificationTypes, type NotificationType } from '@/config/notifications';
import { resolveChannels, type NotificationPreferenceRow } from '@/lib/notifications/channels';

export interface EmailPreference {
  type: NotificationType;
  enabled: boolean;
}

/** Для каждого типа — включён ли email с учётом дефолтов, та же логика, что у отправки. */
export function emailPreferencesFrom(
  prefs: readonly NotificationPreferenceRow[],
  now: Date,
): EmailPreference[] {
  return notificationTypes.map((type) => ({
    type,
    enabled: resolveChannels(type, prefs, now).includes('EMAIL'),
  }));
}

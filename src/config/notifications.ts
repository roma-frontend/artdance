/**
 * NOTIFICATIONS — перечень транзакционных уведомлений бронирования.
 *
 * Конфиг здесь, а не в документации: иначе список разойдётся с кодом на первой
 * неделе. Каждое уведомление — это тип, каналы по умолчанию и ключ дедупликации.
 */

import type { NotificationChannel } from '@/generated/prisma/client';

export const notificationTypes = [
  'booking.confirmed',
  'booking.reminder',
  'booking.cancelled',
  'waitlist.ready',
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export interface NotificationTypeConfig {
  /** Каналы, которые предлагаются по умолчанию, если у пользователя нет предпочтений. */
  defaultChannels: readonly NotificationChannel[];
  /** Идемпотентность: одно письмо на одно событие, а не по разу на ретрай. */
  deduped: boolean;
}

export const notificationConfig: Record<NotificationType, NotificationTypeConfig> = {
  'booking.confirmed': { defaultChannels: ['EMAIL'], deduped: true },
  'booking.reminder': { defaultChannels: ['EMAIL'], deduped: true },
  'booking.cancelled': { defaultChannels: ['EMAIL'], deduped: true },
  'waitlist.ready': { defaultChannels: ['EMAIL'], deduped: true },
};

export function isNotificationType(value: string): value is NotificationType {
  return (notificationTypes as readonly string[]).includes(value);
}

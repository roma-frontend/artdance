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
  'booking.requestDue',
  'cart.abandoned',
  'onboarding.welcome',
  'onboarding.howToBook',
  'onboarding.bonus',
  'savedSearch.match',
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
  'booking.requestDue': { defaultChannels: ['EMAIL'], deduped: true },
  'cart.abandoned': { defaultChannels: ['EMAIL'], deduped: true },
  'onboarding.welcome': { defaultChannels: ['EMAIL'], deduped: true },
  'onboarding.howToBook': { defaultChannels: ['EMAIL'], deduped: true },
  'onboarding.bonus': { defaultChannels: ['EMAIL'], deduped: true },
  'savedSearch.match': { defaultChannels: ['EMAIL'], deduped: true },
};

export function isNotificationType(value: string): value is NotificationType {
  return (notificationTypes as readonly string[]).includes(value);
}

/**
 * Хосты push-сервисов браузеров (C-07). Endpoint подписки принимается только с этих хостов
 * (или их поддоменов): иначе вошедший пользователь направил бы исходящий запрос сервера
 * на произвольный адрес. Новый push-сервис добавляется сюда явно.
 */
export const pushServiceHosts = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
  'notify.windows.com',
] as const;

/** https-endpoint известного push-сервиса: без логина, пароля и нестандартного порта. */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username !== '' || url.password !== '') return false;
  const host = url.hostname.toLowerCase();
  return pushServiceHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

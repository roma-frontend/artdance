import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

import { API_URL } from './config';
import { readServerMessage } from './server-message';
import { getSessionToken } from './session';

export type NotificationType = 'booking.confirmed' | 'booking.reminder' | 'booking.cancelled' | 'waitlist.ready';

export type EmailPreference = { type: NotificationType; enabled: boolean };

export type NotificationItem = {
  id: string;
  type: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'SUPPRESSED';
  createdAt: string;
  sentAt: string | null;
  subject: string | null;
};

export type NotificationsState = { preferences: EmailPreference[]; items: NotificationItem[] };

export class AccountNotificationsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage: string | null = null,
  ) {
    super(message);
  }
}

/** Ошибка ответа с переведённым текстом сервера, если messageKey есть в словаре приложения. */
async function failureFor(response: Response): Promise<AccountNotificationsError> {
  const serverMessage = await readServerMessage(response, catalogFor(deviceLocale(undefined)));
  return new AccountNotificationsError(`HTTP ${response.status}`, response.status, serverMessage);
}

/** Переключатели email и история писем текущего клиента. Личность определяет сервер по bearer-токену. */
export async function loadAccountNotifications(): Promise<NotificationsState> {
  const token = await getSessionToken();
  if (!token) throw new AccountNotificationsError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/account/notifications`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw await failureFor(response);
  return (await response.json()) as NotificationsState;
}

/** Сохраняет email-переключатель для типа. Возвращает итоговый список предпочтений с сервера. */
export async function setEmailPreference(type: NotificationType, email: boolean): Promise<EmailPreference[]> {
  const token = await getSessionToken();
  if (!token) throw new AccountNotificationsError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/account/notifications`, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ type, email }),
  });
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json()) as { preferences: EmailPreference[] };
  return body.preferences;
}

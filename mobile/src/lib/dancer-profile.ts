import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

import { API_URL } from './config';
import { readServerMessage } from './server-message';
import { getSessionToken } from './session';

export type DancerLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export type DancerProfile = {
  level: DancerLevel;
  styles: string[];
  goal: string | null;
  note: string | null;
  onboardingCompleted: boolean;
};

/** Один шаг тура. `completed` — человек дошёл до конца тура. */
export type DancerProfileInput = {
  level: DancerLevel;
  styles: string[];
  goal: string;
  note: string;
  completed: boolean;
};

export class DancerProfileError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage: string | null = null,
  ) {
    super(message);
  }
}

/** Ошибка ответа с переведённым текстом сервера, если messageKey есть в словаре приложения. */
async function failureFor(response: Response): Promise<DancerProfileError> {
  const serverMessage = await readServerMessage(response, catalogFor(deviceLocale(undefined)));
  return new DancerProfileError(`HTTP ${response.status}`, response.status, serverMessage);
}

/** Анкета текущего танцора или `null`, если её ещё нет. Личность определяет сервер по bearer-токену. */
export async function loadDancerProfile(): Promise<DancerProfile | null> {
  const token = await getSessionToken();
  if (!token) throw new DancerProfileError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/account/dancer-profile`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json()) as { profile: DancerProfile | null };
  return body.profile;
}

/** Сохраняет шаг тура и возвращает профиль, как его знает сервер. */
export async function saveDancerProfile(input: DancerProfileInput): Promise<DancerProfile | null> {
  const token = await getSessionToken();
  if (!token) throw new DancerProfileError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/account/dancer-profile`, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json()) as { profile: DancerProfile | null };
  return body.profile;
}

import { catalogFor } from '@/i18n/catalog';
import { deviceLocale, type Locale } from '@/lib/i18n';

import { API_URL } from './config';
import { readServerMessage } from './server-message';
import { getSessionToken } from './session';

export type AccountProfile = {
  name: string;
  email: string;
  locale: Locale;
  timeZone: string;
  avatarUrl: string | null;
};

/** Прямоугольник кадрирования в долях (0..1) от изображения после ориентации. */
export type AvatarCropRect = { x: number; y: number; w: number; h: number };

/** Файл из системного выбора. */
export type PickedImage = { uri: string; name: string; mimeType: string };

export class AccountProfileError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage: string | null = null,
  ) {
    super(message);
  }
}

async function failureFor(response: Response): Promise<AccountProfileError> {
  const serverMessage = await readServerMessage(response, catalogFor(deviceLocale(undefined)));
  return new AccountProfileError(`HTTP ${response.status}`, response.status, serverMessage);
}

async function authorizedHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getSessionToken();
  if (!token) throw new AccountProfileError('UNAUTHORIZED', 401);
  return { Accept: 'application/json', Authorization: `Bearer ${token}`, ...extra };
}

type ProfileListener = (profile: AccountProfile) => void;
const profileListeners = new Set<ProfileListener>();

/** Подписка на новый профиль: вкладки обновляют фото без перезагрузки. */
export function onProfileChange(listener: ProfileListener): () => void {
  profileListeners.add(listener);
  return () => {
    profileListeners.delete(listener);
  };
}

async function readProfile(response: Response): Promise<AccountProfile> {
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json()) as { profile: AccountProfile | null };
  if (!body.profile) throw new AccountProfileError('NOT_FOUND', 404);
  for (const listener of profileListeners) listener(body.profile);
  return body.profile;
}

/** Профиль текущего клиента: имя, email, язык, часовой пояс и аватар. */
export async function loadAccountProfile(): Promise<AccountProfile> {
  const response = await fetch(`${API_URL}/api/account/profile`, { headers: await authorizedHeaders() });
  return readProfile(response);
}

/** Сохраняет язык и/или часовой пояс. Передаются только изменённые поля. */
export async function saveAccountPreferences(input: {
  locale?: Locale;
  timeZone?: string;
}): Promise<AccountProfile> {
  const response = await fetch(`${API_URL}/api/account/profile`, {
    method: 'PATCH',
    headers: await authorizedHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  });
  return readProfile(response);
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/** Сервер проверяет расширение имени файла, поэтому оно должно совпадать с типом. */
function nameWithExtension(name: string, mimeType: string): string {
  const extension = EXTENSION_BY_TYPE[mimeType];
  if (!extension || /\.[a-z0-9]+$/i.test(name)) return name;
  return `${name}.${extension}`;
}

/** Expo `fetch` не принимает RN-файлы в FormData, а XHR отправляет их нативно. */
function postMultipart(url: string, headers: Record<string, string>, form: FormData): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    xhr.onload = () =>
      resolve(new Response(xhr.responseText, { status: xhr.status, headers: { 'Content-Type': 'application/json' } }));
    xhr.onerror = () => reject(new TypeError('Network request failed'));
    xhr.send(form);
  });
}

/**
 * Загружает фото с кадрированием. Сервер режет квадрат по `crop`, так что
 * клиенту не нужен пиксельный кроп и сторонние нативные модули.
 */
export async function uploadAvatar(image: PickedImage, crop?: AvatarCropRect): Promise<AccountProfile> {
  const form = new FormData();
  // В React Native FormData принимает объект с uri вместо Blob.
  const name = nameWithExtension(image.name, image.mimeType);
  form.append('file', { uri: image.uri, name, type: image.mimeType } as unknown as Blob);
  if (crop) {
    form.append('cropX', String(crop.x));
    form.append('cropY', String(crop.y));
    form.append('cropW', String(crop.w));
    form.append('cropH', String(crop.h));
  }

  // Content-Type не задаём: границу multipart выставит сам клиент.
  const response = await postMultipart(`${API_URL}/api/account/avatar`, await authorizedHeaders(), form);
  return readProfile(response);
}

/** Снимает аватар и возвращает профиль без фото. */
export async function removeAvatar(): Promise<AccountProfile> {
  const response = await fetch(`${API_URL}/api/account/avatar`, {
    method: 'DELETE',
    headers: await authorizedHeaders(),
  });
  return readProfile(response);
}

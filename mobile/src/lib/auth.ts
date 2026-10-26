import { API_URL } from './config';
import { readServerMessage } from './server-message';
import {
  clearSessionToken,
  getCachedUserJson,
  getSessionToken,
  setCachedUserJson,
  setSessionToken,
} from './session';

export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  locale: string;
};

/** Подписчики на смену сессии: layout перепроверяет пользователя после входа и выхода. */
const sessionListeners = new Set<() => void>();

export function onSessionChange(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

function notifySessionChange(): void {
  sessionListeners.forEach((listener) => listener());
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getSessionToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${API_URL}/api/auth${path}`, { ...init, headers });
}

async function readError(response: Response): Promise<AuthError> {
  let message = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { message?: string; code?: string };
    if (body.message) message = body.message;
    if (body.code) message = body.code;
  } catch {
    // Тело не JSON — оставляем HTTP-статус.
  }
  return new AuthError(message, response.status);
}

async function storeTokenFrom(response: Response): Promise<void> {
  const token = response.headers.get('set-auth-token');
  if (!token) throw new AuthError('Сервер не вернул токен сессии', response.status);
  await setSessionToken(token);
  notifySessionChange();
}

/** Токен сессии, полученный социальным входом: дальше всё как после входа по паролю. */
export async function adoptSessionToken(token: string): Promise<void> {
  await setSessionToken(token);
  notifySessionChange();
}

/** Вход по identity token Apple с устройства: сервер сам проверяет подпись токена у Apple. */
export async function signInWithAppleIdToken(input: { token: string; firstName?: string | null; lastName?: string | null; email?: string | null }): Promise<void> {
  const response = await request('/sign-in/social', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'apple',
      idToken: {
        token: input.token,
        user: {
          ...(input.email ? { email: input.email } : {}),
          name: { firstName: input.firstName ?? undefined, lastName: input.lastName ?? undefined },
        },
      },
    }),
  });
  if (!response.ok) throw await readError(response);
  await storeTokenFrom(response);
}

export type SignInResult = { status: 'signed-in'; user: User } | { status: 'code-required' };

/**
 * Вход по паролю. Если сервер требует второй шаг, возвращается `code-required`: код отправит `sendTwoFactorCode`.
 * Доверенное устройство держит cookie в хранилище iOS, и тогда второй шаг пропускается.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const response = await request('/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw await readError(response);
  const body = (await response.json()) as { user?: User; twoFactorRedirect?: boolean };
  if (body.twoFactorRedirect) return { status: 'code-required' };
  if (!body.user) throw new AuthError('Сервер не вернул пользователя', response.status);
  await setCachedUserJson(JSON.stringify(body.user)).catch(() => undefined);
  await storeTokenFrom(response);
  return { status: 'signed-in', user: body.user };
}

/** Отправка кода или повторная отправка. Канал выбирает сервер: SMS, если телефон подтверждён, иначе письмо на языке пользователя. */
export async function sendTwoFactorCode(): Promise<void> {
  const response = await request('/two-factor/send-otp', { method: 'POST', body: '{}' });
  if (!response.ok) throw await readError(response);
}

/** Проверка кода. Устройство становится доверенным, поэтому следующие входы с него не просят код. */
export async function verifyTwoFactorCode(code: string): Promise<User> {
  return completeTwoFactor('/two-factor/verify-otp', code);
}

/** Резервный код вместо письма: при успехе тот же результат, что и у кода из письма. */
export async function verifyBackupCode(code: string): Promise<User> {
  return completeTwoFactor('/two-factor/verify-backup-code', code);
}

async function completeTwoFactor(path: string, code: string): Promise<User> {
  const response = await request(path, {
    method: 'POST',
    body: JSON.stringify({ code, trustDevice: true }),
  });
  if (!response.ok) throw await readError(response);
  const body = (await response.json()) as { token?: string; user?: User };
  const token = body.token ?? response.headers.get('set-auth-token');
  if (!token || !body.user) throw new AuthError('Сервер не вернул токен сессии', response.status);
  await setCachedUserJson(JSON.stringify(body.user)).catch(() => undefined);
  await setSessionToken(token);
  notifySessionChange();
  return body.user;
}

export async function signUp(name: string, email: string, password: string): Promise<User> {
  const response = await request('/sign-up/email', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  if (!response.ok) throw await readError(response);
  const { user } = (await response.json()) as { user: User };
  await setCachedUserJson(JSON.stringify(user)).catch(() => undefined);
  await storeTokenFrom(response);
  return user;
}

/** Запрос ссылки для сброса. Ответ одинаковый для любого адреса, поэтому наличие аккаунта не раскрывается. */
export async function requestPasswordReset(email: string, captchaToken: string | null): Promise<void> {
  const response = await fetch(`${API_URL}/api/account/password/forgot`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, captchaToken }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new AuthError(body.error ?? `HTTP ${response.status}`, response.status);
  }
}

/**
 * Установка нового пароля по токену из письма. Сообщение об ошибке переводится сервером по словарю
 * приложения (`catalog`); пустое сообщение означает, что перевода нет и нужно показать общий текст.
 */
export async function resetPassword(
  input: { token: string; password: string; confirmPassword: string },
  catalog: unknown,
): Promise<void> {
  const response = await fetch(`${API_URL}/api/account/password/reset`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const message = (await readServerMessage(response, catalog)) ?? '';
    throw new AuthError(message, response.status);
  }
}

/** Сервер недоступен, а подтверждённого пользователя ещё нет: это не выход, а повод повторить. */
export class SessionUnavailableError extends Error {
  constructor() {
    super('SESSION_UNAVAILABLE');
  }
}

async function cachedUser(): Promise<User | null> {
  try {
    const json = await getCachedUserJson();
    return json ? (JSON.parse(json) as User) : null;
  } catch {
    return null;
  }
}

/**
 * Текущий пользователь или null, если сессии нет или она истекла. Без сети и при 5xx
 * возвращается последний подтверждённый пользователь, а без него — SessionUnavailableError.
 */
export async function getCurrentUser(): Promise<User | null> {
  const token = await getSessionToken();
  if (!token) return null;
  let response: Response;
  try {
    response = await request('/get-session');
  } catch {
    const known = await cachedUser();
    if (known) return known;
    throw new SessionUnavailableError();
  }
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    const known = await cachedUser();
    if (known) return known;
    throw new SessionUnavailableError();
  }
  const body = (await response.json().catch(() => null)) as { user?: User } | null;
  const user = body?.user ?? null;
  if (user) await setCachedUserJson(JSON.stringify(user)).catch(() => undefined);
  return user;
}

/** Смена имени в профиле (адрес и роль здесь не меняются). */
export async function updateName(name: string): Promise<void> {
  const response = await request('/update-user', { method: 'POST', body: JSON.stringify({ name }) });
  if (!response.ok) throw await readError(response);
}

/** Смена пароля; другие устройства выходят из сессии, текущее устройство остаётся. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const response = await request('/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
  });
  if (!response.ok) throw await readError(response);
}

export async function signOut(): Promise<void> {
  // Локальный выход не ждёт сеть: серверный отзыв токена идёт в фоне с лимитом времени.
  const token = await getSessionToken();
  await clearSessionToken();
  notifySessionChange();
  if (!token) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  fetch(`${API_URL}/api/auth/sign-out`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: '{}',
    signal: controller.signal,
  })
    .catch(() => undefined)
    .finally(() => clearTimeout(timer));
}

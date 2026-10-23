import { API_URL } from './config';
import { clearSessionToken, getSessionToken, setSessionToken } from './session';

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

export async function signIn(email: string, password: string): Promise<User> {
  const response = await request('/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw await readError(response);
  await storeTokenFrom(response);
  return ((await response.json()) as { user: User }).user;
}

export async function signUp(name: string, email: string, password: string): Promise<User> {
  const response = await request('/sign-up/email', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  if (!response.ok) throw await readError(response);
  await storeTokenFrom(response);
  return ((await response.json()) as { user: User }).user;
}

/** Текущий пользователь или null, если сессии нет или она истекла. */
export async function getCurrentUser(): Promise<User | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const response = await request('/get-session');
  if (!response.ok) return null;
  const body = (await response.json()) as { user?: User } | null;
  return body?.user ?? null;
}

export async function signOut(): Promise<void> {
  // Ошибка сети не должна мешать локальному выходу: токен всё равно стирается.
  await request('/sign-out', { method: 'POST', body: '{}' }).catch(() => undefined);
  await clearSessionToken();
  notifySessionChange();
}

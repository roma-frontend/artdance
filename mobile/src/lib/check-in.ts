import { API_URL } from './config';
import { getSessionToken } from './session';

/**
 * Касса инструктора/персонала: проверка и отметка пропуска.
 * Сервер отвечает 404 `FEATURE_DISABLED`, если тумблер `events` выключен.
 */

export type PassPeekBooking = {
  reference: string;
  status: string;
  startsAt: string;
  endsAt: string;
  customerName: string | null;
  customerEmail: string | null;
  dancerProfile: { level: string | null; styles: string[]; goal: string | null; note: string | null } | null;
  instructorName: string | null;
  venueName: string | null;
  checkInAt: string | null;
};

export type PassPeek = {
  ok: true;
  alreadyCheckedIn: boolean;
  booking: PassPeekBooking;
};

export type CheckInResult = { ok: true; checkedIn: true; checkInAt: string | null };

export class CheckInError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string | null,
    readonly checkInAt: string | null = null,
  ) {
    super(reason ?? `HTTP ${status}`);
  }
}

/** Достаёт токен из полного URL QR-кода, строки `token=...` или голого токена. Зеркало веб-версии. */
export function extractToken(input: string): string {
  const s = input.trim();
  if (!s) return '';
  try {
    const url = new URL(s);
    const fromUrl = url.searchParams.get('token');
    if (fromUrl) return fromUrl;
  } catch {
    // не URL — пробуем дальше
  }
  const match = s.match(/token=([^&\s]+)/);
  if (match) return decodeURIComponent(match[1] ?? '');
  return s;
}

async function verify(token: string, action: 'peek' | 'checkIn'): Promise<Response> {
  const bearer = await getSessionToken();
  if (!bearer) throw new CheckInError(401, 'UNAUTHORIZED');
  return fetch(`${API_URL}/api/booking/pass/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({ token, action }),
  });
}

async function readBody(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Проверка подлинности пропуска без отметки. */
export async function peekPass(token: string): Promise<PassPeek> {
  const response = await verify(token, 'peek');
  const body = await readBody(response);
  if (!response.ok || body.ok !== true) {
    const reason = typeof body.reason === 'string' ? body.reason : typeof body.error === 'string' ? body.error : null;
    throw new CheckInError(response.status, reason);
  }
  return body as unknown as PassPeek;
}

/** Отмечает посещение. Идемпотентность на стороне сервера: повтор вернёт 409 `ALREADY_CHECKED_IN`. */
export async function checkInPass(token: string): Promise<CheckInResult> {
  const response = await verify(token, 'checkIn');
  const body = await readBody(response);
  if (!response.ok || body.ok !== true) {
    const reason = typeof body.reason === 'string' ? body.reason : typeof body.error === 'string' ? body.error : null;
    const checkInAt = typeof body.checkInAt === 'string' ? body.checkInAt : null;
    throw new CheckInError(response.status, reason, checkInAt);
  }
  return body as unknown as CheckInResult;
}

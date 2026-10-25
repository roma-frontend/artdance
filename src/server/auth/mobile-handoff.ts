import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { db } from '@/lib/db';

/**
 * Передача сессии из браузера входа в мобильное приложение.
 *
 * После OAuth в системном браузере сессия живёт в его cookie. Приложению отдаётся не токен,
 * а одноразовый код на две минуты: перехват ссылки `artdance://` чужим приложением ничего
 * не даёт без verifier, хеш которого приложение передало в начале (схема PKCE).
 */
const PREFIX = 'mobile-handoff:';
const TTL_MS = 2 * 60 * 1000;

export function isValidChallenge(challenge: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(challenge);
}

function challengeOf(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export async function createHandoffCode(input: { sessionToken: string; challenge: string; now: Date }): Promise<string> {
  const code = randomBytes(32).toString('base64url');
  await db.verificationToken.create({
    data: {
      identifier: PREFIX + code,
      value: JSON.stringify({ token: input.sessionToken, challenge: input.challenge }),
      expiresAt: new Date(input.now.getTime() + TTL_MS),
    },
  });
  return code;
}

/** Код погашается при первой попытке, удачной или нет: перебор verifier невозможен. */
export async function consumeHandoffCode(input: { code: string; verifier: string; now: Date }): Promise<string | null> {
  const row = await db.verificationToken.findFirst({ where: { identifier: PREFIX + input.code }, select: { id: true, value: true, expiresAt: true } });
  if (!row) return null;
  const deleted = await db.verificationToken.deleteMany({ where: { id: row.id } });
  if (deleted.count !== 1 || row.expiresAt.getTime() <= input.now.getTime()) return null;
  let stored: { token?: unknown; challenge?: unknown };
  try {
    stored = JSON.parse(row.value) as typeof stored;
  } catch {
    return null;
  }
  if (typeof stored.token !== 'string' || typeof stored.challenge !== 'string') return null;
  const expected = Buffer.from(stored.challenge);
  const actual = Buffer.from(challengeOf(input.verifier));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return stored.token;
}

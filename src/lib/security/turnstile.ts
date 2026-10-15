/**
 * Cloudflare Turnstile.
 *
 * Без `TURNSTILE_SECRET_KEY` пропускаем — позволяет тестировать и писать
 * формы до получения ключей. Настроен → проверка строгая.
 * e2e `auth` проходит без реального Turnstile токена, поэтому fail-open.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 8_000;

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp);

    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    /** Таймаут или сетевая ошибка трактуются как непройденная проверка. */
    return false;
  }
}

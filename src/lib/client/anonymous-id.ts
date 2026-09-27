/**
 * Анонимный идентификатор гостя — держит SlotHold без входа.
 *
 * Почему в localStorage, а не cookie. Hold создаётся fetch-ем, и cookie
 * требует серверной установки и чтения; localStorage даёт тот же id на все
 * запросы одного браузера без участия сервера. При входе гостевой hold
 * не переносится — он привязан к владельцу (userId XOR anonymousId), и
 * server guard проверяет совпадение.
 *
 * Генерация — crypto.randomUUID: короткий cuid не нужен, id никогда не
 * показывается и не попадает в URL.
 */

const STORAGE_KEY = 'ARTDANCE_ANON_ID';

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {}
  return 'anon-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getAnonymousId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const next = uuid();
    window.localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    // Safari private mode или отключённое хранилище — одноразовый id
    return uuid();
  }
}

export function getAnonymousIdSync(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}


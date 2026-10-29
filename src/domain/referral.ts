/**
 * РЕФЕРАЛЬНЫЙ КОД — формат и разбор адреса.
 *
 * Без базы данных и без `server-only`: модулем пользуются и edge-proxy (захват
 * `?ref=`), и серверная регистрация, поэтому он должен грузиться в обоих местах.
 */

import { z } from 'zod';

/**
 * Формат кода из `ensureReferralCode`: латиница и цифры. Ввод приводится так же,
 * как в `bindReferral`: пробелы по краям убираются, регистр становится верхним.
 */
export const referralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1)
  .max(16)
  .regex(/^[A-Z0-9]+$/);

/** Нормализованный код или `null`. Значение приходит снаружи, поэтому не бросает. */
export function parseReferralCode(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const parsed = referralCodeSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Достаёт код из адреса. Возвращает адрес без этого параметра, чтобы код не
 * оставался в строке браузера; остальные параметры сохраняются.
 * `null`, если параметра нет или значение не похоже на код.
 */
export function extractReferralCode(
  url: URL,
  paramName: string,
): { code: string; cleanUrl: URL } | null {
  const code = parseReferralCode(url.searchParams.get(paramName));
  if (!code) return null;
  const cleanUrl = new URL(url.href);
  cleanUrl.searchParams.delete(paramName);
  return { code, cleanUrl };
}

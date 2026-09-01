/**
 * Проверка подписи webhook — HMAC без SDK провайдера.
 *
 * Почему своя реализация: SDK каждого банка тянет десятки зависимостей ради
 * тридцати строк HMAC, а платёжных провайдеров в проекте будет несколько.
 * Функции чистые (`now` инжектится) — значит покрываются тестами без сети.
 *
 * Три обязательных свойства, отсутствие любого из которых делает проверку
 * бессмысленной:
 *
 * 1. **Constant-time сравнение.** Обычное `===` сравнивает побайтово с ранним
 *    выходом и позволяет подобрать подпись по времени ответа.
 * 2. **Окно защиты от реплея.** Валидная подпись остаётся валидной навсегда;
 *    без проверки времени перехваченный запрос можно повторять.
 * 3. **Подпись считается по СЫРОМУ телу.** `await request.json()` уже потерял
 *    порядок ключей и пробелы — подпись не сойдётся.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { webhookSecurity } from '@/config/security';

export type SignatureVerdict =
  | { valid: true; timestamp: number }
  | { valid: false; reason: 'MISSING_INPUT' | 'MALFORMED_HEADER' | 'STALE' | 'MISMATCH' };

/** Сравнение фиксированного времени. Разная длина проверяется отдельно: `timingSafeEqual` на ней бросает. */
export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Формат `t=<unix>,v1=<hex>` — используется Stripe и рядом локальных
 * провайдеров. Подписывается конкатенация `${timestamp}.${rawBody}`, чтобы
 * подпись покрывала и время (иначе timestamp можно подменить).
 */
export function verifyTimestampedSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  now: number = Date.now(),
  toleranceSeconds: number = webhookSecurity.replayToleranceSeconds,
): SignatureVerdict {
  if (!rawBody || !signatureHeader || !secret) return { valid: false, reason: 'MISSING_INPUT' };

  const parts = new Map<string, string>();
  for (const pair of signatureHeader.split(',')) {
    const index = pair.indexOf('=');
    if (index <= 0) continue;
    parts.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }

  const timestamp = Number(parts.get('t'));
  const provided = parts.get('v1');
  if (!Number.isFinite(timestamp) || timestamp <= 0 || !provided) {
    return { valid: false, reason: 'MALFORMED_HEADER' };
  }

  if (Math.abs(now / 1_000 - timestamp) > toleranceSeconds) {
    return { valid: false, reason: 'STALE' };
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return constantTimeEqualHex(expected, provided)
    ? { valid: true, timestamp }
    : { valid: false, reason: 'MISMATCH' };
}

/**
 * Простая схема: подпись = HMAC-SHA256 от тела, без времени. Часть локальных
 * провайдеров работает именно так. Защита от реплея в этом случае обеспечивается
 * ТОЛЬКО дедупликацией по `eventId` в таблице `WebhookEvent` — поэтому она
 * обязательна, а не желательна.
 */
export function verifyBodySignature(
  rawBody: string,
  signature: string | null,
  secret: string,
  encoding: 'hex' | 'base64' = 'hex',
): boolean {
  if (!rawBody || !signature || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest(encoding);
  if (encoding === 'hex') return constantTimeEqualHex(expected, signature.trim());

  const a = Buffer.from(expected, 'base64');
  const b = Buffer.from(signature.trim(), 'base64');
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Подписанный токен без хранения в БД: HMAC от стабильного идентификатора.
 * Применение — ссылки подтверждения, QR-приглашения инструкторов, отписка от
 * рассылки. Ротация секрета аннулирует все выданные токены сразу.
 */
export function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function verifyPayloadSignature(payload: string, signature: string, secret: string): boolean {
  const expected = signPayload(payload, secret);
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

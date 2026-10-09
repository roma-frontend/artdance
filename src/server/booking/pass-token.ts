/**
 * PASS TOKEN — подпись и проверка пропуска брони (QR).
 *
 * Содержимое QR — не id брони, а одноразовый верифицируемый токен. Скриншот
 * чужого QR без подписи бесполезен, replay ограничен checkInAt.
 *
 * Форма: base64url({ bookingId, exp, nonce }).base64url(HMAC_SHA256(payload, AUTH_SECRET))
 * - exp: +24h от момента генерации (покрывает событие «завтра», но не вечный).
 * - nonce: 8 hex случайных байт — делает каждый пропуск уникальным даже для одной брони.
 * - подпись — HMAC из AUTH_SECRET (тот же секрет что у Better Auth), без новых ключей.
 */

import 'server-only';

import crypto from 'node:crypto';

import { getServerEnv } from '@/config/env';

export const PASS_TTL_HOURS = 24;

function b64urlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

function sign(payloadB64url: string): string {
  const secret = getServerEnv().AUTH_SECRET;
  return b64urlEncode(crypto.createHmac('sha256', secret).update(payloadB64url).digest());
}

export interface PassPayload {
  bookingId: string;
  exp: number;
  nonce: string;
}

export function signPassToken(bookingId: string, now = new Date()): string {
  const exp = Math.floor(now.getTime() / 1000) + PASS_TTL_HOURS * 3600;
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload: PassPayload = { bookingId, exp, nonce };
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export type VerifyResult =
  | { ok: true; payload: PassPayload }
  | { ok: false; reason: 'BAD_FORMAT' | 'BAD_SIGNATURE' | 'EXPIRED' | 'BAD_PAYLOAD' };

export function verifyPassToken(token: string, now = new Date()): VerifyResult {
  const dot = token.indexOf('.');
  if (dot <= 0) return { ok: false, reason: 'BAD_FORMAT' };
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payloadB64 || !sig) return { ok: false, reason: 'BAD_FORMAT' };
  const expected = sign(payloadB64);
  // timing-safe compare
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'BAD_SIGNATURE' };
  let payload: PassPayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8')) as PassPayload;
  } catch {
    return { ok: false, reason: 'BAD_PAYLOAD' };
  }
  if (typeof payload.bookingId !== 'string' || typeof payload.exp !== 'number' || typeof payload.nonce !== 'string') {
    return { ok: false, reason: 'BAD_PAYLOAD' };
  }
  if (payload.exp * 1000 < now.getTime()) return { ok: false, reason: 'EXPIRED' };
  return { ok: true, payload };
}

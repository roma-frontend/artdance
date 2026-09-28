/**
 * ANTIFRAUD DETECT — D-01: обход платформы (телефон/email/URL в сообщениях).
 */

const PHONE_RE = /(?:\+?\d[\s-]?){8,}/;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/;
const URL_RE = /https?:\/\/|www\.|\bt\.me\/|\bwa\.me\//i;

export interface Flag { type: 'phone' | 'email' | 'url'; snippet: string }

export function detectCircumvention(text: string): Flag[] {
  const flags: Flag[] = [];
  if (PHONE_RE.test(text)) flags.push({ type: 'phone', snippet: text.slice(0, 60) });
  if (EMAIL_RE.test(text)) flags.push({ type: 'email', snippet: text.slice(0, 60) });
  if (URL_RE.test(text)) flags.push({ type: 'url', snippet: text.slice(0, 60) });
  return flags;
}

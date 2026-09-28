/**
 * INPUT MASKS & VALIDATORS — единый источник форматирования всех полей.
 *
 * Каждое поле форматируется на лету (при вводе) и валидируется по строгим
 * правилам. Маски не ломают курсор и не мешают вставке из буфера.
 */

// ── helpers ──────────────────────────────────────────────────────────────
export const onlyDigits = (v: string) => v.replace(/\D/g, '');
export const onlyDigitsLimited = (v: string, max: number) => onlyDigits(v).slice(0, max);

// ── card ─────────────────────────────────────────────────────────────────
export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'mir' | 'maestro' | 'unknown';

export function detectCardBrand(digits: string): CardBrand {
  const d = onlyDigits(digits);
  if (/^4/.test(d)) return 'visa';
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return 'mastercard';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^220[0-4]/.test(d)) return 'mir';
  if (/^(50|56|57|58|63|67)/.test(d)) return 'maestro';
  return 'unknown';
}

export const cardBrandLabel: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  mir: 'МИР',
  maestro: 'Maestro',
  unknown: '',
};

/** Формат: 1234-5678-9012-3456 — дефис каждые 4 цифры, макс 16 цифр. */
export function formatCardNumber(value: string): string {
  const digits = onlyDigits(value).slice(0, 16);
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += 4) groups.push(digits.slice(i, i + 4));
  return groups.join('-');
}

export function isCardNumberValid(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length < 13 || digits.length > 16) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = parseInt(digits[i]!, 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// ── expiry MM/YY ─────────────────────────────────────────────────────────
/** Формат: MM/YY — слэш после 2 цифр, макс 4 цифры. */
export function formatExpiry(value: string): string {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function isExpiryValid(value: string): boolean {
  const m = value.trim().match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const month = parseInt(m[1]!, 10);
  let year = parseInt(m[2]!, 10);
  if (month < 1 || month > 12) return false;
  year += 2000;
  const exp = new Date(year, month, 0, 23, 59, 59);
  const now = new Date();
  return exp.getTime() >= now.getTime() - 24 * 60 * 60 * 1000;
}

// ── CVV ──────────────────────────────────────────────────────────────────
export function formatCvv(value: string, cardNumber?: string): string {
  const isAmex = /^3[47]/.test(onlyDigits(cardNumber ?? ''));
  const max = isAmex ? 4 : 3;
  return onlyDigitsLimited(value, max);
}

export function isCvvValid(value: string, cardNumber?: string): boolean {
  const digits = onlyDigits(value);
  const isAmex = /^3[47]/.test(onlyDigits(cardNumber ?? ''));
  return isAmex ? digits.length === 4 : digits.length === 3;
}

// ── phone ────────────────────────────────────────────────────────────────
/** Формат: сохраняет + в начале, максимум 15 цифр после. */
export function formatPhone(value: string): string {
  const hasPlus = value.trim().startsWith('+');
  const digits = onlyDigits(value).slice(0, 15);
  if (!digits) return hasPlus ? '+' : '';
  // Не навязываем (XXX) XXX-XX-XX — оставляем цифры с + для международных номеров
  // Но убираем лишние символы, оставляем только + и цифры + форматирующие пробелы/дефисы нельзя — пользователь их не ждёт
  // Поэтому просто: +XXXXXXXXXXX
  return hasPlus ? `+${digits}` : digits;
}

export function isPhoneValid(value: string): boolean {
  const digits = onlyDigits(value);
  // 8..15 digits — международный формат
  return digits.length >= 8 && digits.length <= 15;
}

// ── email ────────────────────────────────────────────────────────────────
export function isEmailValid(value: string): boolean {
  const t = value.trim();
  if (!t.includes('@')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t);
}

// ── password ─────────────────────────────────────────────────────────────
export function passwordChecks(value: string, minLength = 10) {
  return {
    length: value.length >= minLength,
    number: /\d/.test(value),
    maxLength: value.length <= 128,
  };
}
export function isPasswordValid(value: string, minLength = 10, requireNumber = true): boolean {
  const c = passwordChecks(value, minLength);
  if (!c.length || !c.maxLength) return false;
  if (requireNumber && !c.number) return false;
  return true;
}

// ── name ─────────────────────────────────────────────────────────────────
export function formatName(value: string): string {
  // Разрешаем буквы (включая кириллицу/армянские), пробел, дефис, апостроф. Обрезаем дубли
  return value.replace(/[^A-Za-zА-Яа-яЁёԱ-Ֆա-ֆ\s'-]/g, '').slice(0, 80);
}
export function isNameValid(value: string, min = 2): boolean {
  return value.trim().length >= min;
}

// ── postal code ──────────────────────────────────────────────────────────
export function formatPostalCode(value: string): string {
  return value.replace(/[^A-Za-z0-9 -]/g, '').slice(0, 12);
}
export function isPostalCodeValid(value: string): boolean {
  const t = value.trim();
  if (!t) return true; // необязательное
  return /^[A-Za-z0-9 -]{3,12}$/.test(t);
}

// ── cardholder ───────────────────────────────────────────────────────────
export function formatCardholder(value: string): string {
  // Только латиница + пробел/дефис/апостроф, верхний регистр
  return value
    .replace(/[^A-Za-z\s'-]/g, '')
    .toUpperCase()
    .slice(0, 64);
}

// ── generic ──────────────────────────────────────────────────────────────
export function formatEmailInput(value: string): string {
  // Запрещаем пробелы внутри
  return value.replace(/\s/g, '').slice(0, 254);
}

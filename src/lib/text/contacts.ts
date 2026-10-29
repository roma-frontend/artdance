/**
 * КОНТАКТЫ В СВОБОДНОМ ТЕКСТЕ (D-01): телефон, e-mail, @-ник и ссылка на мессенджер.
 *
 * Эвристика, а не барьер: она ловит очевидные случаи и легко обходится (буквами,
 * словом «собака», пробелами внутри цифр). Поэтому результат — повод для ручной
 * проверки, а не отказ. Жёсткую фильтрацию текста отвергли: docs/00-decision-record.md.
 *
 * Чистая функция без БД и без `server-only`, поэтому годится и на клиенте.
 */

export type ContactKind = 'phone' | 'email' | 'handle' | 'link';

export interface ContactMatch {
  kind: ContactKind;
  /** Границы в единицах UTF-16, как у `String.prototype.slice`. */
  start: number;
  end: number;
}

/** Один знак на каждую единицу кода: длина текста после маскировки не меняется. */
const MASK_CHAR = '•';

/* Ссылка проверяется первой: иначе номер из wa.me/… засчитается дважды. */
const LINK_RE =
  /(?:https?:\/\/|www\.)[^\s<>"']+|(?<![\p{L}\p{N}.-])(?:t\.me|telegram\.me|wa\.me|m\.me|viber\.com|vk\.com|instagram\.com|facebook\.com|tiktok\.com)\/[^\s<>"']*/giu;
const EMAIL_RE = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;
const HANDLE_RE = /(?<![\p{L}\p{N}_@])@[\p{L}\p{N}_]{3,32}/gu;
/*
 * Телефон: цифры с разделителями, не больше двух символов-разделителей подряд.
 * Так диапазон дат «12.09.2026 - 13.09.2026» не склеивается в один номер.
 */
const PHONE_RE = /(?<!\p{N})\+?\d(?:[ \t().-]{0,2}\d)*/gu;

const digitsIn = (raw: string): number => raw.replace(/\D/g, '').length;

/**
 * Контакты в тексте. Возвращает непересекающиеся совпадения по порядку в тексте.
 * `minPhoneDigits` берётся из `booking.contactGuard.minPhoneDigits`.
 */
export function findContactInfo(text: string, minPhoneDigits: number): ContactMatch[] {
  const found: ContactMatch[] = [];

  const collect = (re: RegExp, kind: ContactKind, accept: (raw: string, end: number) => boolean) => {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (!accept(m[0], end)) continue;
      if (found.some((f) => start < f.end && f.start < end)) continue;
      found.push({ kind, start, end });
    }
  };

  collect(LINK_RE, 'link', () => true);
  collect(EMAIL_RE, 'email', () => true);
  collect(HANDLE_RE, 'handle', () => true);
  // «12.09.2026 19:00»: двоеточие сразу после цифр значит время, а не номер.
  collect(PHONE_RE, 'phone', (raw, end) => digitsIn(raw) >= minPhoneDigits && text[end] !== ':');

  return found.sort((a, b) => a.start - b.start);
}

/** Текст с замаскированными контактами. Длина не меняется; значение в БД эта функция не трогает. */
export function maskContactInfo(text: string, minPhoneDigits: number): string {
  let out = '';
  let cursor = 0;
  for (const { start, end } of findContactInfo(text, minPhoneDigits)) {
    out += text.slice(cursor, start) + MASK_CHAR.repeat(end - start);
    cursor = end;
  }
  return out + text.slice(cursor);
}

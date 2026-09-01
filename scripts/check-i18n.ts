/**
 * Проверка каталогов переводов.
 *
 *   npm run i18n:check
 *
 * Ловит то, что не ловит TypeScript:
 *   1. лишние/недостающие ключи относительно `en` (эталон);
 *   2. пустые строки — «ключ есть, перевода нет»;
 *   3. расхождение ICU-плейсхолдеров между языками ({price} есть в en, нет в ru);
 *   4. строки, оставшиеся на английском в неанглийском каталоге (эвристика).
 */

import { locales, type Locale } from '../src/i18n/config.ts';
import en from '../src/i18n/messages/en.ts';
import ru from '../src/i18n/messages/ru.ts';
import hy from '../src/i18n/messages/hy.ts';

type Tree = Record<string, unknown>;

const catalogs: Record<Locale, Tree> = {
  en: en as unknown as Tree,
  ru: ru as unknown as Tree,
  hy: hy as unknown as Tree,
};

const REFERENCE: Locale = 'en';

/**
 * Имя ICU-аргумента: `{price}`, `{count, plural, …}`.
 * Отрицательный отбор текста внутри ветвей плюрала (`{No classes}`) достигается
 * требованием, чтобы сразу после идентификатора шла `,` или `}`.
 */
const PLACEHOLDER = /\{\s*([A-Za-z_]\w*)\s*(?=[,}])/g;

function flatten(tree: Tree, prefix = '', out = new Map<string, string>()): Map<string, string> {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else if (value && typeof value === 'object') flatten(value as Tree, path, out);
    else out.set(path, String(value));
  }
  return out;
}

function placeholders(value: string): Set<string> {
  const found = new Set<string>();
  for (const match of value.matchAll(PLACEHOLDER)) {
    if (match[1]) found.add(match[1]);
  }
  return found;
}

const reference = flatten(catalogs[REFERENCE]);
const problems: string[] = [];

for (const locale of locales) {
  if (locale === REFERENCE) continue;
  const current = flatten(catalogs[locale]);

  for (const key of reference.keys()) {
    if (!current.has(key)) problems.push(`[${locale}] отсутствует ключ: ${key}`);
  }
  for (const key of current.keys()) {
    if (!reference.has(key)) problems.push(`[${locale}] лишний ключ: ${key}`);
  }

  for (const [key, value] of current) {
    const refValue = reference.get(key);
    if (refValue === undefined) continue;

    if (value.trim() === '') {
      problems.push(`[${locale}] пустой перевод: ${key}`);
      continue;
    }

    const refPh = placeholders(refValue);
    const curPh = placeholders(value);
    for (const p of refPh) {
      if (!curPh.has(p)) problems.push(`[${locale}] потерян плейсхолдер {${p}} в ${key}`);
    }
    for (const p of curPh) {
      if (!refPh.has(p)) problems.push(`[${locale}] лишний плейсхолдер {${p}} в ${key}`);
    }
  }
}

/** Ключи, где совпадение с английским — норма (бренд, техтермины, форматы). */
const ALLOWED_IDENTICAL = [
  /^brand\.name$/,
  /^danceStyles\.(heels|kpop)$/,
  /^checkout\.payment\.method(Arca|Idram|Telcell|Qr)$/,
  /^checkout\.trust\.arcaVerified$/,
  /^(cart|checkout)\.trust.*$/,
  /^cart\.trustPayments$/,
  /^studio\.amenities\.wifi$/,
  /^status\.payment\.chargeback$/,
  /^events\.typeShowcase$/,
  /^home\.newsletter\.emailPlaceholder$/,
  /^pricing\.plans\.\w+\.name$/,
  /^auth\.signIn\.emailLabel$/,
  /^checkout\.contact\.email$/,
  /^.*\.timeRange$/,
  /^.*\.priceNote$/,
  /^.*\.areaNote$/,
  /^.*\.calendarTitle$/,
  /^.*statsRating$/,
  /^.*\.cvv$/i,
  /^legal\.cookieBanner\.title$/,
  /^.*squareMeters$/,
];

for (const locale of locales) {
  if (locale === REFERENCE) continue;
  const current = flatten(catalogs[locale]);
  for (const [key, value] of current) {
    const refValue = reference.get(key);
    if (refValue === undefined || refValue !== value) continue;
    if (ALLOWED_IDENTICAL.some((re) => re.test(key))) continue;
    problems.push(`[${locale}] перевод совпадает с английским: ${key} = "${value}"`);
  }
}

if (problems.length > 0) {
  console.error(`i18n:check — найдено проблем: ${problems.length}\n`);
  for (const p of problems) console.error('  •', p);
  process.exit(1);
}

console.log(`i18n:check — OK (${reference.size} ключей × ${locales.length} локали)`);

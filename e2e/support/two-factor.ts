/**
 * Второй шаг входа (код из письма) для e2e.
 *
 * Код в базе лежит только как хеш (`storeOTP: 'hashed'`), поэтому тест не может
 * прочитать его напрямую. Хеш — SHA-256 в base64url, а код — шесть цифр, то есть
 * миллион вариантов: тест перебирает их локально. Это работает только против
 * тестовой базы: настоящий человек получает код на почту или телефон, а не из
 * базы, и защита от этого не ослабляется.
 *
 * Шаг появляется сразу после входа, а код создаётся фоновым запросом отправки,
 * поэтому helper ждёт, пока строка появится в базе.
 */

import { createHash } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { expect, type Page } from '@playwright/test';

import { PrismaClient } from '../../src/generated/prisma/client';
import en from '../../src/i18n/messages/en';

const CHALLENGE_COOKIE = 'artdance.two_factor';
const CODE_LENGTH = 6;

/** Перебирает все шестизначные коды и возвращает тот, чей хеш совпал с хранимым. */
function crackCode(stored: string): string | undefined {
  for (let n = 0; n < 10 ** CODE_LENGTH; n += 1) {
    const candidate = String(n).padStart(CODE_LENGTH, '0');
    if (createHash('sha256').update(candidate).digest('base64url') === stored) return candidate;
  }
  return undefined;
}

/** Код текущего challenge, или `undefined`, пока письмо ещё не записано в базу. */
export async function currentCode(page: Page): Promise<string | undefined> {
  const cookie = (await page.context().cookies()).find((item) => item.name === CHALLENGE_COOKIE);
  if (!cookie) return undefined;

  // Подписанная cookie имеет вид `<идентификатор>.<подпись>`: идентификатор — до последней точки.
  const raw = decodeURIComponent(cookie.value);
  const challengeId = raw.slice(0, raw.lastIndexOf('.'));

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    const row = await db.verificationToken.findFirst({
      where: { identifier: `2fa-otp-${challengeId}` },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return undefined;
    return crackCode(row.value.split(':')[0]!);
  } finally {
    await db.$disconnect();
  }
}

/**
 * Ввести код второго шага. Вызывать сразу после отправки формы входа, когда
 * вход ожидается успешным. Поле отправляет форму само, когда введено шесть цифр.
 */
export async function completeTwoFactor(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 2, name: en.auth.otp.title })).toBeVisible();

  let code: string | undefined;
  await expect
    .poll(async () => {
      code = await currentCode(page);
      return code;
    }, { timeout: 15_000 })
    .toMatch(/^\d{6}$/);

  await page.getByLabel(en.auth.otp.title).fill(code!);
}

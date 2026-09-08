/**
 * БЛОКИРОВКА ПОСЛЕ СЕРИИ НЕУДАЧНЫХ ВХОДОВ.
 *
 * **Зачем отдельно от ограничения частоты.** Rate limit отвечает на вопрос «как
 * часто», lockout — «сколько всего». Медленный перебор (одна попытка в минуту)
 * проходит под любым разумным лимитом частоты бесконечно: за сутки это 1440
 * паролей на один адрес, и на слабом пароле этого достаточно. Поэтому считаются
 * обе величины, и обе — из `security.login`.
 *
 * **Почему не хук библиотеки.** Better Auth знает про частоту запросов, но не про
 * нашу таблицу `LoginAttempt` и не про правило «пять неудач — четверть часа
 * тишины». Реализация в нашем коде даёт полный контроль над тем, что считается
 * неудачей, и проверяется тестом. Применяется она из хука `hooks.before` в
 * `auth.ts` — единственной точки, через которую проходят оба пути входа: форма
 * (server action) и публичный `/api/auth/sign-in/email`.
 *
 * **Ключ — адрес, а не IP.** Считать по IP значит блокировать целый офис за
 * NAT'ом из-за одного человека с забытым паролем, и одновременно ничего не давать
 * против распределённого перебора одного адреса. Атакующий целится в аккаунт, и
 * защищается аккаунт. IP ограничивает частоту, и это другой механизм.
 *
 * **Счётчик сгорает от времени, а не от успеха соседа.** Неудачи старше
 * `failureWindowMinutes` не учитываются: человек, который ошибся дважды в январе,
 * не должен получить блокировку с третьей ошибки в марте.
 *
 * **Ответ на заблокированный аккаунт не раскрывает его существование.** Наружу
 * уходит один и тот же код с числом минут — и для существующего адреса, и для
 * выдуманного (см. `signIn` в действиях): иначе форма входа превращается в
 * способ проверять, зарегистрирован ли человек на платформе.
 */

import 'server-only';

import { security } from '@/config/business';
import { db } from '@/lib/db';

const MS_PER_MINUTE = 60_000;

export interface LockoutState {
  locked: boolean;
  /** Сколько минут осталось. Ноль, если не заблокировано. */
  remainingMinutes: number;
  /** Сколько попыток осталось до блокировки. */
  attemptsLeft: number;
}

/** Нормализация ключа: адрес — регистронезависим, пробелы по краям не значимы. */
export function lockoutKey(email: string): string {
  return email.trim().toLowerCase();
}

function minutesUntil(moment: Date, now: Date): number {
  return Math.max(0, Math.ceil((moment.getTime() - now.getTime()) / MS_PER_MINUTE));
}

/**
 * Состояние блокировки для адреса.
 *
 * Не изменяет данные: вызывается до попытки входа, чтобы отказать до проверки
 * пароля. Проверять пароль у заблокированного аккаунта незачем — это работа,
 * которую оплачивает атака.
 */
export async function lockoutState(email: string, now: Date = new Date()): Promise<LockoutState> {
  const record = await db.loginAttempt.findUnique({
    where: { identifier: lockoutKey(email) },
    select: { failures: true, lockedUntil: true, lastFailureAt: true },
  });

  if (!record) {
    return { locked: false, remainingMinutes: 0, attemptsLeft: security.login.maxFailures };
  }

  if (record.lockedUntil && record.lockedUntil.getTime() > now.getTime()) {
    return {
      locked: true,
      remainingMinutes: minutesUntil(record.lockedUntil, now),
      attemptsLeft: 0,
    };
  }

  /* Окно прошло — счётчик считается сгоревшим, не дожидаясь записи в базу. */
  const stale =
    now.getTime() - record.lastFailureAt.getTime() >
    security.login.failureWindowMinutes * MS_PER_MINUTE;
  const failures = stale ? 0 : record.failures;

  return {
    locked: false,
    remainingMinutes: 0,
    attemptsLeft: Math.max(0, security.login.maxFailures - failures),
  };
}

/**
 * Учесть неудачную попытку. Возвращает состояние ПОСЛЕ учёта — чтобы вызывающий
 * код мог сказать «осталось две попытки», не делая второго запроса.
 *
 * Блокировка ставится ровно на `maxFailures`-й неудаче и продлевается при каждой
 * следующей: попытка входа во время блокировки — это продолжение перебора, а не
 * повод сократить ожидание.
 */
export async function recordFailure(email: string, now: Date = new Date()): Promise<LockoutState> {
  const identifier = lockoutKey(email);
  const existing = await db.loginAttempt.findUnique({
    where: { identifier },
    select: { failures: true, lastFailureAt: true },
  });

  const stale =
    existing &&
    now.getTime() - existing.lastFailureAt.getTime() >
      security.login.failureWindowMinutes * MS_PER_MINUTE;

  const failures = (stale ? 0 : existing?.failures ?? 0) + 1;
  const locked = failures >= security.login.maxFailures;
  const lockedUntil = locked
    ? new Date(now.getTime() + security.login.lockoutMinutes * MS_PER_MINUTE)
    : null;

  await db.loginAttempt.upsert({
    where: { identifier },
    update: { failures, lockedUntil, lastFailureAt: now },
    create: { identifier, failures, lockedUntil, lastFailureAt: now },
  });

  return {
    locked,
    remainingMinutes: lockedUntil ? minutesUntil(lockedUntil, now) : 0,
    attemptsLeft: Math.max(0, security.login.maxFailures - failures),
  };
}

/**
 * Сбросить счётчик после успешного входа.
 *
 * Запись удаляется, а не обнуляется: нулевая строка не несёт информации, а
 * таблица иначе растёт по одной строке на каждый когда-либо ошибившийся адрес.
 */
export async function clearFailures(email: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { identifier: lockoutKey(email) } });
}

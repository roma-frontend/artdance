/**
 * ПЕРИОДИЧЕСКИЕ ЗАДАЧИ — то, что должно случаться между бронированиями.
 *
 * Едут на 15-минутном тике `runBookingCron`, отдельных cron-записей нет:
 *   1. чистка истёкших сессий входа;
 *   2. отправка отложенных писем, у которых наступил `scheduledFor`;
 *   3. напоминания о брошенных корзинах (C-04);
 *   4. письма онбординга, не больше одного на пользователя за тик (C-09);
 *   5. проверка сохранённых поисков: письмо, когда появились новые совпадения (C-05);
 *   6. ежедневный дайджест оператору — раз в UTC-сутки, с первого тика от 04:00 UTC.
 *
 * Каждая задача изолирована: сбой одной логируется и не отменяет остальные.
 */

import 'server-only';

import { isNotificationType } from '@/config/notifications';
import type { Locale } from '@/i18n/config';
import { db } from '@/lib/db';
import { renderEmail } from '@/lib/notifications/render';
import { deliverNotificationRow } from '@/lib/notifications/send';
import { sendAbandonedCartReminders } from '@/server/cart/abandonment';
import { sendOnboardingEmails } from '@/server/onboarding/drip';
import { runSavedSearchAlerts } from '@/server/saved-search/alerts';

export interface PeriodicReport {
  sessionsPurged: number;
  scheduledSent: number;
  abandonedCartReminders: number;
  onboardingSent: number;
  savedSearchAlerts: number;
  digestSent: boolean;
}

/**
 * Запуск дайджеста; `sent` — провайдер принял письмо. Передаётся аргументом,
 * а не импортируется: `tasks.ts` импортирует этот модуль, и обратный импорт дал бы цикл.
 */
export type DigestRunner = (now: Date) => Promise<{ sent: boolean }>;

/** Сколько отложенных писем берём за тик; остаток уйдёт на следующих тиках. */
const SCHEDULED_BATCH_SIZE = 200;
/** Дайджест уходит первым тиком, который пришёлся на этот час UTC или позже. */
const DIGEST_HOUR_UTC = 4;
/** OperatorSetting: UTC-дата (YYYY-MM-DD) последней попытки дайджеста. */
const DIGEST_DAY_KEY = 'cron.digest.sentOn';

export async function runPeriodicJobs(now: Date, runDigest: DigestRunner): Promise<PeriodicReport> {
  const sessionsPurged = await guard('sessions', 0, () => purgeExpiredSessions(now));
  const scheduledSent = await guard('scheduled-notifications', 0, () => dispatchScheduledEmails(now));
  const abandonedCartReminders = await guard('abandoned-carts', 0, () => sendAbandonedCartReminders(now));
  const onboardingSent = await guard('onboarding', 0, () => sendOnboardingEmails(now));
  const savedSearchAlerts = await guard('saved-search-alerts', 0, () => runSavedSearchAlerts(now));
  const digestSent = await guard('digest', false, () => sendDigestOnce(now, runDigest));
  return { sessionsPurged, scheduledSent, abandonedCartReminders, onboardingSent, savedSearchAlerts, digestSent };
}

/** Изоляция задачи: сбой логируется, вместо результата берётся запасное значение. */
async function guard<T>(job: string, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`[cron:${job}]`, error);
    return fallback;
  }
}

async function purgeExpiredSessions(now: Date): Promise<number> {
  const result = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  return result.count;
}

interface ScheduledRow {
  id: string;
  userId: string;
  type: string;
  locale: Locale;
  payload: unknown;
}

async function dispatchScheduledEmails(now: Date): Promise<number> {
  const rows = await db.notification.findMany({
    where: { status: 'QUEUED', channel: 'EMAIL', scheduledFor: { lte: now } },
    orderBy: { scheduledFor: 'asc' },
    take: SCHEDULED_BATCH_SIZE,
    select: { id: true, userId: true, type: true, locale: true, payload: true },
  });

  let sent = 0;
  for (const row of rows) {
    try {
      if (await deliverScheduledRow(row)) sent += 1;
    } catch (error) {
      console.error('[cron:scheduled-notifications]', error);
    }
  }
  return sent;
}

/** Перерисовывает письмо из payload и отправляет тем же путём, что и немедленное уведомление. */
async function deliverScheduledRow(row: ScheduledRow): Promise<boolean> {
  const { type } = row;
  if (!isNotificationType(type)) {
    await markFailed(row.id, 'unknown-type');
    return false;
  }

  const user = await db.user.findUnique({ where: { id: row.userId }, select: { email: true } });
  if (!user) {
    await markFailed(row.id, 'recipient-not-found');
    return false;
  }

  const rendered = await renderEmail({ type, locale: row.locale, data: templateData(row.payload) });
  return deliverNotificationRow(row.id, user.email, row.locale, rendered);
}

async function markFailed(id: string, reason: string): Promise<void> {
  await db.notification.update({ where: { id }, data: { status: 'FAILED', failureReason: reason } });
}

/**
 * Значения для подстановки из payload (when, title, href и т. п.). Тексты писем берутся из каталога i18n,
 * поэтому subject и heading из payload рендер не использует. Они остаются в payload: список уведомлений
 * и preferences.ts читают `subject`.
 */
function templateData(payload: unknown): Record<string, string | number> {
  const data: Record<string, string | number> = {};
  if (typeof payload !== 'object' || payload === null) return data;
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' || typeof value === 'number') data[key] = value;
  }
  return data;
}

/**
 * Дайджест раз в UTC-сутки. День ставится до отправки, поэтому неудачная отправка
 * в этот день не повторяется: причина видна в логе (`[email]`).
 */
async function sendDigestOnce(now: Date, runDigest: DigestRunner): Promise<boolean> {
  if (now.getUTCHours() < DIGEST_HOUR_UTC) return false;

  const day = now.toISOString().slice(0, 10);
  const marker = await db.operatorSetting.findUnique({ where: { key: DIGEST_DAY_KEY }, select: { value: true } });
  if (marker?.value === day) return false;

  await db.operatorSetting.upsert({
    where: { key: DIGEST_DAY_KEY },
    create: { key: DIGEST_DAY_KEY, value: day, updatedBy: 'cron' },
    update: { value: day, updatedBy: 'cron' },
  });

  const report = await runDigest(now);
  return report.sent;
}

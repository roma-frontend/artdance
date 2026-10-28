/**
 * Бюджет платных SMS (D-05). Считает SMS, принятые провайдером, за скользящие окна
 * из `config/sms.ts`. При исчерпании ставит запись в очередь ручной проверки.
 */

import 'server-only';

import { smsBudget, type SmsBudgetPeriod } from '@/config/sms';
import { db } from '@/lib/db';
import { assertSmsBudget, SmsBudgetExceededError } from '@/lib/notifications/channels';

export const SMS_BUDGET_REVIEW_KIND = 'SMS_BUDGET_EXCEEDED';

export type SmsBudgetCheck = { ok: true } | { ok: false; period: SmsBudgetPeriod };

const HOUR_MS = 60 * 60_000;

/**
 * Проверяет оба окна до отправки. Ошибка чтения базы пробрасывается: без известного
 * счёта SMS не отправляется.
 */
export async function checkSmsBudget(now: Date): Promise<SmsBudgetCheck> {
  const since = (period: SmsBudgetPeriod) => new Date(now.getTime() - smsBudget[period].windowHours * HOUR_MS);
  const [day, month] = await Promise.all([
    db.smsDispatch.count({ where: { createdAt: { gt: since('day') } } }),
    db.smsDispatch.count({ where: { createdAt: { gt: since('month') } } }),
  ]);
  try {
    assertSmsBudget(day, 'day');
    assertSmsBudget(month, 'month');
    return { ok: true };
  } catch (error) {
    if (!(error instanceof SmsBudgetExceededError)) throw error;
    await enqueueBudgetReview(error.period, now);
    return { ok: false, period: error.period };
  }
}

/** Ключ периода по UTC: одна запись на сутки или на месяц. Повтор не создаёт дубль. */
function periodKey(period: SmsBudgetPeriod, now: Date): string {
  const iso = now.toISOString();
  return period === 'day' ? `sms:day:${iso.slice(0, 10)}` : `sms:month:${iso.slice(0, 7)}`;
}

async function enqueueBudgetReview(period: SmsBudgetPeriod, now: Date): Promise<void> {
  const subject = periodKey(period, now);
  const label = period === 'day' ? 'за сутки' : 'за 30 дней';
  try {
    await db.reviewQueueEntry.upsert({
      where: { kind_subject: { kind: SMS_BUDGET_REVIEW_KIND, subject } },
      update: {},
      create: {
        kind: SMS_BUDGET_REVIEW_KIND,
        subject,
        reason: `Лимит SMS ${label} исчерпан: отправка приостановлена до освобождения окна`,
      },
    });
  } catch (error) {
    // Запись очереди не меняет решение: лимит соблюдён и без неё.
    console.error('[sms] запись очереди проверки не сохранена', error);
  }
}

/**
 * Каналы доставки уведомлений.
 *
 * Каталог требует: настройки пользователя ∩ матрица типа ∩ тихие часы ∩ лимит SMS.
 * Пока SMS не подключён, тихие часы — заглушка. Бюджет SMS проверяется до отправки
 * (lib/sms/budget.ts). EMAIL — единственный канал.
 */

import { notificationConfig, type NotificationType } from '@/config/notifications';
import { smsBudget, type SmsBudgetPeriod } from '@/config/sms';
import type { NotificationChannel } from '@/generated/prisma/client';

export interface NotificationPreferenceRow {
  channel: NotificationChannel;
  type: string;
  enabled: boolean;
}

export function resolveChannels(
  type: NotificationType,
  prefs: readonly NotificationPreferenceRow[],
  now: Date,
): readonly NotificationChannel[] {
  const cfg = notificationConfig[type];
  if (!cfg) return [];
  if (prefs.length === 0) return cfg.defaultChannels;
  const relevant = prefs.filter((p) => p.type === type);
  if (relevant.length === 0) return cfg.defaultChannels;
  const enabled = relevant.filter((p) => p.enabled).map((p) => p.channel);
  if (enabled.length === 0) return [];
  void now;
  return enabled;
}

/** Превышен лимит SMS за период: бросается до отправки, рассылка на весь список не уйдёт. */
export class SmsBudgetExceededError extends Error {
  readonly period: SmsBudgetPeriod;

  constructor(period: SmsBudgetPeriod) {
    super(`SMS budget exceeded for ${period}`);
    this.name = 'SmsBudgetExceededError';
    this.period = period;
  }
}

/**
 * Страховка от рассылки на весь список из-за ошибки в цикле.
 * `count` — SMS, уже принятые провайдером за окно `period`.
 */
export function assertSmsBudget(count: number, period: SmsBudgetPeriod): void {
  if (count >= smsBudget[period].limit) throw new SmsBudgetExceededError(period);
}

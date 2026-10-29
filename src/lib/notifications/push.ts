/**
 * PUSH (C-07) — Web Push: выбор канала и отправка.
 * `preferredChannel` даёт PUSH, если Web Push настроен на сервере (VAPID), тумблер `push` в тарифе
 * включён и у пользователя есть активная подписка; иначе EMAIL.
 * `sendPushToUser` шлёт на все подписки пользователя и удаляет подписки, отозванные браузером (404/410).
 * Наружу не бросает: сбой push не должен ронять бронь.
 *
 * **SMS здесь намеренно нет.** Шлюза нет ни в коде, ни у заказчика
 * (`SMS_SENDER_ID` — 2–3 недели на регистрацию), а канал, который не отправляется,
 * хуже его отсутствия: уведомление помечается доставленным и до адресата не
 * доходит. С включением провайдера сюда добавляется одна ветка — см.
 * `docs/06-implementation-plan.md` «вне договора».
 */

import 'server-only';

import * as webpush from 'web-push';

import { getServerEnv } from '@/config/env';
import { isAllowedPushEndpoint } from '@/config/notifications';
import { db } from '@/lib/db';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';

export interface PushPayload {
  title: string;
  body: string;
  href?: string;
  tag?: string;
}

export interface PushSendResult {
  sent: number;
  removed: number;
}

/** Сутки: позже уведомление о брони уже не нужно. */
const PUSH_TTL_SECONDS = 24 * 60 * 60;

/** Ответы push-сервиса, при которых подписка мертва и её нужно удалить. */
const GONE_STATUSES = new Set([404, 410]);

/** `setVapidDetails` достаточно вызвать один раз на процесс. */
let vapidApplied = false;

/** Полная VAPID-настройка или null. Частичная настройка — «push выключен», а не ошибка. */
function vapidConfig(): { subject: string; publicKey: string; privateKey: string } | null {
  try {
    const env = getServerEnv();
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return null;
    return {
      subject: env.VAPID_SUBJECT,
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
    };
  } catch {
    return null;
  }
}

/** Настроен ли Web Push на сервере (все три VAPID-значения). */
export function isPushConfigured(): boolean {
  return vapidConfig() !== null;
}

export async function hasActivePushSubscription(userId: string): Promise<boolean> {
  const sub = await db.pushSubscription.findFirst({ where: { userId } });
  return Boolean(sub);
}

/** PUSH, если Web Push настроен, тариф включает push и у пользователя есть подписка. Иначе EMAIL. */
export async function preferredChannel(userId: string, type?: string): Promise<'PUSH' | 'EMAIL'> {
  void type;
  if (!isPushConfigured()) return 'EMAIL';
  const pushEnabled = (await getEffectiveEntitlementsSafe()).push;
  if (!pushEnabled) return 'EMAIL';
  if (await hasActivePushSubscription(userId)) return 'PUSH';
  return 'EMAIL';
}

/**
 * Шлёт уведомление на все подписки пользователя. Не бросает исключений:
 * при сбое возвращает `sent: 0`, и вызывающий код решает сам (например, шлёт письмо).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushSendResult> {
  const result: PushSendResult = { sent: 0, removed: 0 };
  try {
    const vapid = vapidConfig();
    if (!vapid) return result;
    if (!vapidApplied) {
      webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
      vapidApplied = true;
    }

    const subscriptions = await db.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    const body = JSON.stringify(payload);

    for (const sub of subscriptions) {
      // Адрес не из списка push-сервисов не трогаем: защита от исходящих запросов на чужие хосты.
      if (!isAllowedPushEndpoint(sub.endpoint)) continue;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: PUSH_TTL_SECONDS },
        );
        result.sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: unknown } | null)?.statusCode;
        console.warn('[push] delivery failed', { status });
        if (typeof status === 'number' && GONE_STATUSES.has(status)) {
          try {
            const removed = await db.pushSubscription.deleteMany({ where: { id: sub.id } });
            result.removed += removed.count;
          } catch {
            console.warn('[push] could not remove stale subscription');
          }
        }
      }
    }
  } catch (error) {
    console.warn('[push] send aborted', { status: (error as { statusCode?: unknown } | null)?.statusCode });
  }
  return result;
}

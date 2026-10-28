/**
 * PUSH (C-07) — выбор канала: PUSH, если тумблер `push` включён и есть активная подписка, иначе EMAIL.
 * Хранение PushSubscription уже в схеме (endpoint/keys).
 * **Статус: отправка Web Push не подключена.** Пакета `web-push` нет в `package.json`, `lib/notifications/send.ts`
 * пропускает канал PUSH («позже»), `preferredChannel` нигде не вызывается: уведомления уходят только по email.
 * См. `docs/06-implementation-plan.md`.
 *
 * **SMS здесь намеренно нет.** Шлюза нет ни в коде, ни у заказчика
 * (`SMS_SENDER_ID` — 2–3 недели на регистрацию), а канал, который не отправляется,
 * хуже его отсутствия: уведомление помечается доставленным и до адресата не
 * доходит. С включением провайдера сюда добавляется одна ветка — см.
 * `docs/06-implementation-plan.md` «вне договора».
 */

import 'server-only';

import { db } from '@/lib/db';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';

export async function hasActivePushSubscription(userId: string): Promise<boolean> {
  const sub = await db.pushSubscription.findFirst({ where: { userId } });
  return Boolean(sub);
}

export async function preferredChannel(userId: string, type?: string): Promise<'PUSH' | 'EMAIL'> {
  void type;
  const pushEnabled = (await getEffectiveEntitlementsSafe()).push;
  if (pushEnabled && (await hasActivePushSubscription(userId))) return 'PUSH';
  return 'EMAIL';
}

/**
 * PUSH (C-07) — Web Push вместо SMS, когда подписка есть, иначе SMS→Email fallback.
 * Хранение PushSubscription уже в схеме (endpoint/keys), отправка — через web-push на проде,
 * в dev — заглушка. Выбор канала: PUSH если есть активная подписка, иначе SMS если phone,
 * иначе EMAIL — один sendBookingNotification покрывает оба сценария.
 */

import 'server-only';

import { db } from '@/lib/db';

export async function hasActivePushSubscription(userId: string): Promise<boolean> {
  const sub = await db.pushSubscription.findFirst({ where: { userId } });
  return Boolean(sub);
}

export async function preferredChannel(userId: string, _type?: string): Promise<'PUSH' | 'SMS' | 'EMAIL'> {
  if (await hasActivePushSubscription(userId)) return 'PUSH';
  const user = await db.user.findUnique({ where: { id: userId }, select: { phone: true, email: true } });
  if (user?.phone) return 'SMS';
  return 'EMAIL';
}

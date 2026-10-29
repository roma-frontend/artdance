/**
 * NOTIFY — единая точка постановки уведомлений бронирования.
 *
 * Пишет в Notification (QUEUED) и тут же отправляет: Web Push, если получатель подписан
 * и тариф включает push; иначе email. Отложенные уведомления — только email: их отправляет
 * runPeriodicJobs (src/server/cron/periodic.ts) через deliverNotificationRow.
 * Дедупликация — по (userId, type, dedupeKey): повторный вызов с тем же ключом
 * не создаёт второе письмо (идемпотентность ретраев и дублей cron).
 *
 * Отправка писем — best effort: отсутствие RESEND_API_KEY не роняет бронь.
 */

import 'server-only';

import { notificationConfig, type NotificationType } from '@/config/notifications';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { resolveChannels, type NotificationPreferenceRow } from '@/lib/notifications/channels';
import { preferredChannel, sendPushToUser, type PushPayload } from '@/lib/notifications/push';
import { renderEmail, type RenderedEmail } from '@/lib/notifications/render';
import type { Locale } from '@/i18n/config';
import type { NotificationChannel } from '@/generated/prisma/client';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  locale?: Locale;
  data: Record<string, string | number>;
  channels?: readonly NotificationChannel[];
  scheduledFor?: Date;
  dedupeKey?: string;
  href?: string;
}

/**
 * Возвращает true, если строка уведомления создана (push или письмо поставлены в очередь).
 * false — тип выключен, получатель не найден, дубликат или все каналы отключены пользователем.
 */
export async function notify(input: NotifyInput): Promise<boolean> {
  const cfg = notificationConfig[input.type];
  if (!cfg) return false;

  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { locale: true, email: true },
  });
  if (!user) return false;

  const locale = (input.locale ?? (user.locale as Locale) ?? 'ru') as Locale;

  // дедупликация — точный поиск по ключу: не шлём второй раз то же событие (ретрай / двойной cron)
  if (cfg.deduped && input.dedupeKey) {
    const duplicate = await db.notification.findFirst({
      where: { userId: input.userId, type: input.type, payload: { path: ['dedupeKey'], equals: input.dedupeKey } },
      select: { id: true },
    });
    if (duplicate) return false;
  }

  let prefs: readonly NotificationPreferenceRow[] = [];
  try {
    prefs = (await db.notificationPreference.findMany({
      where: { userId: input.userId },
      select: { channel: true, type: true, enabled: true },
    })) as unknown as NotificationPreferenceRow[];
  } catch {
    prefs = [];
  }

  const channels: readonly NotificationChannel[] =
    input.channels ?? resolveChannels(input.type, prefs, new Date());

  if (channels.length === 0) return false;

  const dataWithHref = input.href ? { ...input.data, href: input.href } : input.data;
  const rendered = await renderEmail({ type: input.type, locale, data: dataWithHref });

  let queued = false;

  // PUSH — раньше email. Письмо уходит, только если ни одно устройство не приняло push
  // (или push не настроен / не включён). Отложенные уведомления остаются email-only.
  const immediate = !input.scheduledFor || input.scheduledFor.getTime() <= Date.now();
  const acceptsPush = channels.includes('EMAIL') || channels.includes('PUSH');
  if (immediate && acceptsPush && (await isPushPreferred(input.userId, input.type))) {
    const href = rendered.ctaHref || input.href || undefined;
    const pushed = await deliverByPush({
      userId: input.userId,
      type: input.type,
      locale,
      payload: {
        ...dataWithHref,
        subject: rendered.subject,
        heading: rendered.heading,
        ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
      },
      message: {
        title: rendered.subject,
        body: rendered.paragraphs[0] ?? rendered.heading,
        ...(href ? { href } : {}),
        ...(input.dedupeKey ? { tag: input.dedupeKey } : {}),
      },
    });
    queued = pushed.recorded;
    if (pushed.delivered) return true;
  }

  for (const channel of channels) {
    if (channel !== 'EMAIL') continue; // SMS — позже; PUSH обработан выше

    const payload: Record<string, unknown> = {
      ...dataWithHref,
      subject: rendered.subject,
      heading: rendered.heading,
      ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
    };

    const notification = await db.notification.create({
      data: {
        userId: input.userId,
        channel: 'EMAIL',
        type: input.type,
        status: 'QUEUED',
        payload: payload as never,
        locale,
        scheduledFor: input.scheduledFor ?? null,
      } as never,
      select: { id: true },
    });

    queued = true;

    // Немедленная отправка, если не отложено
    if (input.scheduledFor && input.scheduledFor.getTime() > Date.now()) continue;

    await deliverNotificationRow(notification.id, user.email, locale, rendered);
  }

  return queued;
}

/**
 * Отправляет письмо по строке Notification и пишет итог: SENT или FAILED с причиной.
 * Общий путь для немедленной отправки в notify() и для отложенных строк (periodic.ts).
 * Возвращает true, если провайдер принял письмо. Не бросает: сбой фиксируется в строке.
 */
export async function deliverNotificationRow(
  notificationId: string,
  to: string,
  locale: Locale,
  rendered: RenderedEmail,
): Promise<boolean> {
  try {
    const result = await sendEmail({
      to,
      locale,
      subject: rendered.subject,
      heading: rendered.heading,
      paragraphs: rendered.paragraphs,
      ...(rendered.ctaLabel && rendered.ctaHref ? { action: { label: rendered.ctaLabel, href: rendered.ctaHref } } : {}),
      ...(rendered.footnote ? { footnote: rendered.footnote } : {}),
    });

    await db.notification.update({
      where: { id: notificationId },
      data: {
        status: result.delivered ? 'SENT' : 'FAILED',
        providerMessageId: result.providerMessageId ?? null,
        failureReason: result.delivered ? null : (result.reason ?? 'unknown'),
        sentAt: result.delivered ? new Date() : null,
      } as never,
    });
    return result.delivered;
  } catch (error) {
    await db.notification.update({
      where: { id: notificationId },
      data: {
        status: 'FAILED',
        failureReason: String((error as Error)?.message ?? error).slice(0, 500),
      } as never,
    });
    return false;
  }
}

/** Вход записи PUSH-уведомления: `payload` совпадает со строкой EMAIL, `message` уходит в браузер. */
interface PushDelivery {
  userId: string;
  type: NotificationType;
  locale: Locale;
  payload: Record<string, unknown>;
  message: PushPayload;
}

/** Нужен ли Web Push получателю: сервер настроен, тариф включён, есть подписка. */
async function isPushPreferred(userId: string, type: NotificationType): Promise<boolean> {
  try {
    return (await preferredChannel(userId, type)) === 'PUSH';
  } catch (error) {
    console.error('[notify:push]', error);
    return false;
  }
}

/**
 * Записывает строку PUSH и отправляет её на все устройства получателя.
 * `recorded` — строка создана, `delivered` — хотя бы одно устройство приняло push.
 * Не бросает: при сбое записи вызывающий код уходит на email.
 */
async function deliverByPush(delivery: PushDelivery): Promise<{ delivered: boolean; recorded: boolean }> {
  let notificationId: string;
  try {
    const row = await db.notification.create({
      data: {
        userId: delivery.userId,
        channel: 'PUSH',
        type: delivery.type,
        status: 'QUEUED',
        payload: delivery.payload,
        locale: delivery.locale,
        scheduledFor: null,
      } as never,
      select: { id: true },
    });
    notificationId = row.id;
  } catch (error) {
    console.error('[notify:push]', error);
    return { delivered: false, recorded: false };
  }

  const { sent } = await sendPushToUser(delivery.userId, delivery.message);

  const outcome =
    sent > 0
      ? { status: 'SENT', sentAt: new Date(), failureReason: null }
      : { status: 'FAILED', failureReason: 'push-not-delivered' };
  try {
    await db.notification.update({ where: { id: notificationId }, data: outcome as never });
  } catch (error) {
    console.error('[notify:push]', error);
  }

  return { delivered: sent > 0, recorded: true };
}

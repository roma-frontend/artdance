/**
 * NOTIFY — единая точка постановки уведомлений бронирования.
 *
 * Пишет в Notification (QUEUED) и тут же пытается отправить email.
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
import { renderEmail } from '@/lib/notifications/render';
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

export async function notify(input: NotifyInput): Promise<void> {
  const cfg = notificationConfig[input.type];
  if (!cfg) return;

  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { locale: true, email: true },
  });
  if (!user) return;

  const locale = (input.locale ?? (user.locale as Locale) ?? 'ru') as Locale;

  // дедупликация — не шлём второй раз то же событие (ретрай / двойной cron)
  if (cfg.deduped && input.dedupeKey) {
    const recent = await db.notification.findMany({
      where: { userId: input.userId, type: input.type } as never,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { payload: true },
    });
    for (const row of recent) {
      const payload = row.payload as Record<string, unknown> | null;
      if (payload?.dedupeKey === input.dedupeKey) return;
    }
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

  if (channels.length === 0) return;

  const dataWithHref = input.href ? { ...input.data, href: input.href } : input.data;
  const rendered = await renderEmail({ type: input.type, locale, data: dataWithHref });

  for (const channel of channels) {
    if (channel !== 'EMAIL') continue; // SMS/PUSH — позже

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

    // Немедленная отправка, если не отложено
    if (input.scheduledFor && input.scheduledFor.getTime() > Date.now()) continue;

    try {
      const result = await sendEmail({
        to: user.email,
        locale,
        subject: rendered.subject,
        heading: rendered.heading,
        paragraphs: rendered.paragraphs,
        ...(rendered.ctaLabel && rendered.ctaHref ? { action: { label: rendered.ctaLabel, href: rendered.ctaHref } } : {}),
        ...(rendered.footnote ? { footnote: rendered.footnote } : {}),
      });

      await db.notification.update({
        where: { id: notification.id },
        data: {
          status: result.delivered ? 'SENT' : 'FAILED',
          providerMessageId: result.providerMessageId ?? null,
          failureReason: result.delivered ? null : (result.reason ?? 'unknown'),
          sentAt: result.delivered ? new Date() : null,
        } as never,
      });
    } catch (error) {
      await db.notification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          failureReason: String((error as Error)?.message ?? error).slice(0, 500),
        } as never,
      });
    }
  }
}

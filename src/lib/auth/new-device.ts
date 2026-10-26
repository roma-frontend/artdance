/**
 * ВХОД С НОВОГО УСТРОЙСТВА — письмо владельцу аккаунта.
 *
 * Устройство «новое», если у аккаунта нет другой сессии с тем же user-agent.
 * Первый вход в аккаунт письма не порождает: там не с чем сравнивать, и письмо
 * «вы вошли впервые» — шум, который приучает игнорировать следующее.
 *
 * Ошибка отправки не отменяет вход: письмо — дополнительная защита, а не условие
 * входа. Сбой логируется без адреса и тела письма.
 */

import 'server-only';

import { defaultLocale, isLocale } from '@/i18n/config';
import { loadMessages } from '@/i18n/messages';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';

export interface NewDeviceInput {
  userId: string;
  /** Id только что созданной сессии: сама она не считается «предыдущей». */
  sessionId: string;
  userAgent: string | null;
}

export async function notifyNewDevice({ userId, sessionId, userAgent }: NewDeviceInput): Promise<void> {
  // Без user-agent сравнивать не с чем: молча пропускаем, а не шлём письмо на каждый вход.
  if (!userAgent) return;

  try {
    const sameDevice = await db.session.count({
      where: { userId, userAgent, id: { not: sessionId } },
    });
    if (sameDevice > 0) return;

    const otherSessions = await db.session.count({ where: { userId, id: { not: sessionId } } });
    if (otherSessions === 0) return;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, locale: true },
    });
    if (!user) return;

    const locale = user.locale && isLocale(user.locale) ? user.locale : defaultLocale;
    const messages = await loadMessages(locale);
    const copy = messages.email.newDevice;
    const brand = messages.brand.name;

    await sendEmail({
      to: user.email,
      locale,
      subject: copy.subject.replaceAll('{brand}', brand),
      heading: copy.heading,
      paragraphs: [copy.body],
      footnote: copy.footnote,
    });
  } catch (error) {
    console.error('[auth] письмо о новом устройстве не отправлено', error);
  }
}

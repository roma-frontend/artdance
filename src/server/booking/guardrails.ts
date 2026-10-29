/**
 * ОЧЕРЕДЬ ПРОВЕРКИ КОНТАКТОВ В БРОНИ (D-01). Бронь не блокируется: решение за
 * оператором. В очередь пишем только поля и виды контактов, но не их значения.
 */

import 'server-only';

import { db } from '@/lib/db';

export const BOOKING_CONTACT_REVIEW_KIND = 'BOOKING_CONTACT_TEXT';

export async function flagBookingContactText(input: {
  bookingId: string;
  fields: readonly string[];
  kinds: readonly string[];
}): Promise<void> {
  const subject = `booking:${input.bookingId}`;
  try {
    await db.reviewQueueEntry.upsert({
      where: { kind_subject: { kind: BOOKING_CONTACT_REVIEW_KIND, subject } },
      update: {},
      create: {
        kind: BOOKING_CONTACT_REVIEW_KIND,
        subject,
        reason: `contact-text fields=${input.fields.join(',')} kinds=${input.kinds.join(',')}`,
      },
    });
  } catch (error) {
    /* Сбой очереди не отменяет уже созданную бронь. */
    console.error('[booking] запись очереди проверки контактов не сохранена', error);
  }
}

/**
 * Бронирование места на обычном событии (воркшоп, батл, мастер-класс и т.п.).
 *
 * Соревнования используют отдельную заявку с категориями. Для остальных событий
 * место живёт в общей модели Booking, поэтому его можно оплатить и показать в
 * том же кабинете/QR-пропуске, что и остальные брони.
 */

import 'server-only';

import { randomUUID } from 'node:crypto';

import { booking } from '@/config/business';
import { domainErrors } from '@/domain/errors';
import { registrationIsOpen } from '@/domain/competition';
import { db } from '@/lib/db';
import { notifyBookingConfirmed } from '@/server/booking/notify';

function referenceFromId(id: string): string {
  return `BK-${id.slice(-8).toUpperCase()}`;
}

export interface CreateEventBookingInput {
  userId: string;
  eventSlug: string;
  now?: Date;
}

export async function createEventBooking(input: CreateEventBookingInput) {
  const now = input.now ?? new Date();

  const result = await db.$transaction(async (tx) => {
    const event = await tx.event.findFirst({
      where: { slug: input.eventSlug, isPublished: true, type: { not: 'COMPETITION' } },
      select: {
        id: true,
        title: true,
        venueId: true,
        startsAt: true,
        endsAt: true,
        price: true,
        capacity: true,
        registrationOpenAt: true,
        registrationCloseAt: true,
      },
    });

    if (
      !event ||
      event.startsAt <= now ||
      !registrationIsOpen(now, { openAt: event.registrationOpenAt, closeAt: event.registrationCloseAt })
    ) {
      throw domainErrors.eventRegistrationClosed();
    }

    const existing = await tx.booking.findFirst({
      where: {
        eventId: event.id,
        customerId: input.userId,
        subject: 'EVENT_TICKET',
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: { id: true },
    });
    if (existing) throw domainErrors.duplicateEnrollment();

    const reserved = await tx.event.updateMany({
      where: { id: event.id, bookedCount: { lt: event.capacity } },
      data: { bookedCount: { increment: 1 } },
    });
    if (reserved.count !== 1) throw domainErrors.capacityExceeded(0);

    const status = event.price > 0 ? 'PENDING' : 'CONFIRMED';
    const created = await tx.booking.create({
      data: {
        reference: `tmp-event-${randomUUID()}`,
        subject: 'EVENT_TICKET',
        lessonType: 'GROUP',
        status,
        customerId: input.userId,
        instructorId: null,
        venueId: event.venueId,
        roomId: null,
        sessionId: null,
        eventId: event.id,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        participants: 1,
        partnerName: null,
        locationOption: 'STUDIO',
        customerAddress: null,
        basePrice: event.price,
        travelFee: 0,
        discountAmount: 0,
        totalPrice: event.price,
        cancellationWindowHours: booking.freeCancellationHours,
        lateCancellationRate: booking.lateCancellationFeeRate,
        rescheduleWindowHours: booking.freeRescheduleHours,
        maxReschedules: booking.maxReschedulesPerBooking,
      },
      select: { id: true, totalPrice: true, startsAt: true, endsAt: true, status: true },
    });

    const updated = await tx.booking.update({
      where: { id: created.id },
      data: { reference: referenceFromId(created.id) },
      select: { id: true, reference: true, totalPrice: true, startsAt: true, endsAt: true, status: true },
    });

    return { ...updated, title: event.title };
  });

  if (result.status === 'CONFIRMED') void notifyBookingConfirmed(result.id).catch(() => {});
  return result;
}

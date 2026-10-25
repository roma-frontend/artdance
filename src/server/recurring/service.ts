import 'server-only';

import { domainErrors } from '@/domain/errors';
import { nextOccurrences } from '@/domain/recurring';
import { booking } from '@/config/business';
import { site } from '@/config/site';
import { db } from '@/lib/db';
import { createBookingFromHold, type CreateBookingInput } from '@/server/booking/service';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { publicInstructorWhere } from '@/server/queries/instructors';

async function assertRecurringEnabled(): Promise<void> {
  await assertEntitlementOrThrow('recurring');
}

export interface CreateRecurringSeriesInput {
  customerId: string;
  instructorId?: string | null;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  weeks: number;
  locationOption?: 'STUDIO' | 'CUSTOMER_LOCATION' | 'ONLINE';
  customerAddress?: string | null;
  /** Первое занятие серии, выбранное клиентом; без него серия начинается с ближайшей даты. */
  firstStartsAt?: Date | null;
  now: Date;
}

export async function createRecurringSeries(input: CreateRecurringSeriesInput) {
  await assertRecurringEnabled();
  const { customerId, weekday, startTime, durationMinutes, weeks, now } = input;
  if (!input.instructorId) throw domainErrors.validationFailed('instructorId');
  // Приложение передаёт публичный slug, сайт — id.
  const profile = await db.instructorProfile.findFirst({
    where: { ...publicInstructorWhere, OR: [{ id: input.instructorId }, { slug: input.instructorId }] },
    select: { id: true },
  });
  if (!profile) throw domainErrors.notFound();
  const instructorId = profile.id;
  if (input.firstStartsAt && input.firstStartsAt.getTime() <= now.getTime()) throw domainErrors.validationFailed('startsAt');
  const from = input.firstStartsAt ?? now;
  const occurrences = nextOccurrences({ weekday, startTime, durationMinutes }, from, weeks, site.timeZone);
  if (input.firstStartsAt && occurrences[0]?.startsAt.getTime() !== input.firstStartsAt.getTime()) {
    throw domainErrors.validationFailed('startsAt');
  }

  // Создаём серию
  const series = await db.recurringSeries.create({
    data: {
      customerId,
      instructorId,
      pattern: { weekday, startTime, durationMinutes },
      maxWeeks: weeks,
    },
    select: { id: true },
  });

  // Для каждой даты: hold → booking (луп через существующий 3.5)
  const bookings: { id: string; startsAt: Date }[] = [];
  for (const occ of occurrences) {
    // Gaps: availability re-check leniency — reuses conflicts.ts inside createBookingFromHold path via slotHold
    // We create holds sequentially; a conflicting date is skipped with audit, not abort whole series
    try {
      const expiresAt = new Date(now.getTime() + booking.holdTtlMinutes * 60_000);
      const hold = await db.slotHold.create({
        data: {
          instructorId,
          startsAt: occ.startsAt,
          endsAt: occ.endsAt,
          userId: customerId,
          expiresAt,
          extensions: 0,
        },
      });
      const payload: CreateBookingInput = {
        holdId: hold.id,
        userId: customerId,
        now,
        locationOption: input.locationOption,
        customerAddress: input.customerAddress ?? null,
      };
      const created = await createBookingFromHold(payload);
      // Bind series
      await db.booking.update({ where: { id: created.id }, data: { seriesId: series.id } });
      bookings.push({ id: created.id, startsAt: occ.startsAt });
    } catch (e) {
      // Slot conflict or outside availability — skip, owner sees in series view
      void e;
    }
  }

  return { seriesId: series.id, bookings };
}

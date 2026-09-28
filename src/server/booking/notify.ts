import 'server-only';

import { absoluteUrl } from '@/config/site';
import { booking } from '@/config/business';
import { db } from '@/lib/db';
import { notify } from '@/lib/notifications/send';
import type { Locale } from '@/i18n/config';

function formatWhen(date: Date, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Yerevan',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

async function bookingDisplay(bookingId: string): Promise<{
  title: string;
  instructorName: string;
  location: string;
  customerId: string;
  startsAt: Date;
} | null> {
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      customerId: true,
      startsAt: true,
      instructorId: true,
      venueId: true,
      roomId: true,
      sessionId: true,
      locationOption: true,
    },
  });
  if (!b) return null;

  let title = 'Booking';
  let instructorName = '';
  let location: string = (b.locationOption as string) ?? 'STUDIO';

  if (b.sessionId) {
    const session = await db.classSession.findUnique({
      where: { id: b.sessionId },
      select: { danceClass: { select: { title: true, slug: true } } },
    });
    if (session?.danceClass?.title) title = session.danceClass.title;
  } else if (b.instructorId) {
    const inst = await db.instructorProfile.findUnique({
      where: { id: b.instructorId },
      select: { headline: true, slug: true, user: { select: { name: true } } },
    });
    const name =
      ((inst as unknown as { headline?: string } | null)?.headline as string | undefined) ??
      (inst as unknown as { user?: { name?: string } } | null)?.user?.name;
    if (name) {
      instructorName = name;
      title = `Session with ${name}`;
    }
  }

  if (b.instructorId && !instructorName) {
    const inst = await db.instructorProfile.findUnique({
      where: { id: b.instructorId },
      select: { headline: true, user: { select: { name: true } } },
    });
    const name =
      ((inst as unknown as { headline?: string } | null)?.headline as string | undefined) ??
      (inst as unknown as { user?: { name?: string } } | null)?.user?.name;
    if (name) instructorName = name;
  }

  if (b.venueId) {
    const venue = await db.venue.findUnique({ where: { id: b.venueId }, select: { name: true } });
    if (venue?.name) location = venue.name;
  }

  return { title, instructorName, location, customerId: b.customerId, startsAt: b.startsAt };
}

export async function notifyBookingConfirmed(bookingId: string): Promise<void> {
  const info = await bookingDisplay(bookingId);
  if (!info) return;
  const user = await db.user.findUnique({ where: { id: info.customerId }, select: { locale: true } });
  const locale = (user?.locale as Locale) ?? 'ru';
  const when = formatWhen(info.startsAt, locale);
  await notify({
    userId: info.customerId,
    type: 'booking.confirmed',
    locale,
    data: {
      title: info.title,
      instructor: info.instructorName || '—',
      when,
      location: info.location,
      hours: String(booking.freeCancellationHours),
    },
    dedupeKey: `booking:${bookingId}:confirmed`,
    href: absoluteUrl(`/${locale}/account/bookings/${bookingId}`),
  });
}

export async function notifyBookingCancelled(bookingId: string, refund: number | string): Promise<void> {
  const info = await bookingDisplay(bookingId);
  if (!info) return;
  const user = await db.user.findUnique({ where: { id: info.customerId }, select: { locale: true } });
  const locale = (user?.locale as Locale) ?? 'ru';
  const when = formatWhen(info.startsAt, locale);
  await notify({
    userId: info.customerId,
    type: 'booking.cancelled',
    locale,
    data: {
      title: info.title,
      when,
      refund: String(refund),
    },
    dedupeKey: `booking:${bookingId}:cancelled`,
    href: absoluteUrl(`/${locale}/classes`),
  });
}

export async function notifyBookingReminder(bookingId: string, hoursOffset: number): Promise<void> {
  const info = await bookingDisplay(bookingId);
  if (!info) return;
  const user = await db.user.findUnique({ where: { id: info.customerId }, select: { locale: true } });
  const locale = (user?.locale as Locale) ?? 'ru';
  const when = formatWhen(info.startsAt, locale);
  await notify({
    userId: info.customerId,
    type: 'booking.reminder',
    locale,
    data: {
      title: info.title,
      instructor: info.instructorName || '—',
      when,
      location: info.location,
    },
    dedupeKey: `booking:${bookingId}:reminder:${hoursOffset}`,
    href: absoluteUrl(`/${locale}/account/bookings/${bookingId}`),
  });
}

export async function notifyWaitlistReady(sessionId: string, userId: string, claimUntil: Date): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
  const locale = (user?.locale as Locale) ?? 'ru';
  const when = formatWhen(claimUntil, locale);
  await notify({
    userId,
    type: 'waitlist.ready',
    locale,
    data: {
      subject: 'Your waitlist spot is ready',
      body: `A spot opened up. Claim it before ${when}.`,
      href: `/${locale}/classes`,
      when,
    } as unknown as Record<string, string | number>,
    dedupeKey: `waitlist:${sessionId}:${userId}:${claimUntil.toISOString()}`,
    href: absoluteUrl(`/${locale}/classes`),
  });
}

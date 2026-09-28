/**
 * ICS — текст/calendar для брони (A-06). Защищён владельцем/стаффом, как pass.
 */

import { db } from '@/lib/db';
import { getCaller } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function icsDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export async function GET(_req: Request, ctx: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await ctx.params;
  const caller = await getCaller();
  if (!caller) return new Response('Unauthorized', { status: 401 });

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, reference: true, startsAt: true, endsAt: true, customerId: true },
  });
  if (!booking) return new Response('Not found', { status: 404 });
  const isOwner = booking.customerId === caller.id;
  const isStaff = caller.role === 'ADMIN' || caller.role === 'SUPPORT';
  if (!isOwner && !isStaff) return new Response('Forbidden', { status: 403 });

  const uid = `${booking.id}@artdance.am`;
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ArtDance//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(new Date(booking.startsAt))}`,
    `DTEND:${icsDate(new Date(booking.endsAt))}`,
    `SUMMARY:${escapeIcs(`ArtDance — бронь ${booking.reference}`)}`,
    `DESCRIPTION:${escapeIcs(`Бронь ${booking.reference}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="artdance-${booking.reference}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}

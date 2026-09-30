/**
 * ICS — текст/calendar для брони (A-06, RFC 5545).
 *
 * Доступен владельцу брони или стаффу (как pass). Письма клиенту (`email/ics`)
 * указывают на этот адрес: клиент сохраняет событие в календарь одним кликом.
 * Для стадий события (WDSF, social) — аналогичный адрес `/api/ics/event/[id]`
 * генерируется отдельно; здесь только брони (Booking).
 */

import { db } from '@/lib/db';
import { getCaller } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function icsDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/**
 * Сворачивание строк по RFC 5545 §3.1: строки не длиннее 75 октетов,
 * продолжение начинается с одного пробела. Считаем в байтах UTF-8,
 * но режем по символам — достаточно для наших заголовков.
 */
function foldLines(ics: string): string {
  const lines = ics.split('\r\n');
  const out: string[] = [];
  for (const line of lines) {
    const bytes = Buffer.byteLength(line, 'utf8');
    if (bytes <= 75) {
      out.push(line);
      continue;
    }
    // Простая свёртка: каждые 74 символа + пробел на продолжении.
    let rest = line;
    let first = true;
    while (rest.length > 0) {
      const chunk = first ? rest.slice(0, 75) : rest.slice(0, 74);
      out.push(first ? chunk : ` ${chunk}`);
      rest = rest.slice(chunk.length);
      first = false;
    }
  }
  return out.join('\r\n');
}

export async function GET(_req: Request, ctx: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await ctx.params;
  const caller = await getCaller();
  if (!caller) return new Response('Unauthorized', { status: 401 });

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      reference: true,
      subject: true,
      locationOption: true,
      customerAddress: true,
      startsAt: true,
      endsAt: true,
      customerId: true,
      venue: { select: { name: true, addressLine: true, city: true } },
      instructor: { select: { user: { select: { name: true } } } },
    },
  });
  if (!booking) return new Response('Not found', { status: 404 });
  const isOwner = booking.customerId === caller.id;
  const isStaff = caller.role === 'ADMIN' || caller.role === 'SUPPORT';
  if (!isOwner && !isStaff) return new Response('Forbidden', { status: 403 });

  const uid = `${booking.id}@artdance.am`;
  const when = `${new Date(booking.startsAt).toLocaleString('ru-AM')} – ${new Date(booking.endsAt).toLocaleString('ru-AM')}`;
  const location =
    ([booking.venue?.addressLine, booking.venue?.city].filter(Boolean).join(', ') ||
      booking.venue?.name) ??
    booking.customerAddress ??
    booking.locationOption ??
    '';
  const instructorName = booking.instructor?.user.name ?? '';
  const summary = escapeIcs(`ArtDance — ${booking.subject ?? `бронь ${booking.reference}`}`);
  const description = escapeIcs(
    [`Бронь ${booking.reference}`, `Когда: ${when}`, instructorName ? `Инструктор: ${instructorName}` : '', location ? `Где: ${location}` : '']
      .filter(Boolean)
      .join('\\n'),
  );

  const raw = [
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
    `SUMMARY:${summary}`,
    ...(location ? [`LOCATION:${escapeIcs(location)}`] : []),
    `DESCRIPTION:${description}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs('Напоминание: бронь ' + booking.reference)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const body = foldLines(raw);

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="artdance-${booking.reference}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}

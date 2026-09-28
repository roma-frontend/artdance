/**
 * ICS — календарный файл для брони.
 *
 * Одноразовый файл на бронь: UID = бронь, DTSTAMP = сейчас.
 * Часовой пояс — Europe/UTC в формате UTC (Z), чтобы не зависеть от клиента.
 */

import type { Interval } from '@/lib/time/interval';

function formatUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

function escapeText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replaceAll('\n', '\\n');
}

export interface BuildIcsInput {
  uid: string;
  interval: Interval;
  title: string;
  description: string;
  location?: string;
  url: string;
}

export function buildIcs(input: BuildIcsInput): string {
  const now = new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ArtDance//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeText(input.uid)}`,
    `DTSTAMP:${formatUtc(now)}`,
    `DTSTART:${formatUtc(input.interval.start)}`,
    `DTEND:${formatUtc(input.interval.end)}`,
    `SUMMARY:${escapeText(input.title)}`,
    `DESCRIPTION:${escapeText(input.description)}`,
    ...(input.location ? [`LOCATION:${escapeText(input.location)}`] : []),
    `URL:${escapeText(input.url)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

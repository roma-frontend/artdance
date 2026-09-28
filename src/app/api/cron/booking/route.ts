import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerEnv } from '@/config/env';
import { runBookingCron } from '@/server/cron/tasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function noStore(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' },
  });
}

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function providedSecret(request: Request): string | null {
  const h = request.headers.get('authorization');
  if (h?.startsWith('Bearer ')) return h.slice('Bearer '.length);
  return request.headers.get('x-cron-secret');
}

export async function POST(request: Request) {
  const expected = getServerEnv().CRON_SECRET;
  if (!expected) return noStore({ error: 'CRON_DISABLED' }, 503);
  const provided = providedSecret(request);
  if (!provided || !secretMatches(provided, expected)) return noStore({ error: 'UNAUTHORIZED' }, 401);
  const report = await runBookingCron(new Date());
  return noStore({ status: 'ok', ...report });
}

export async function GET(request: Request) {
  return POST(request);
}

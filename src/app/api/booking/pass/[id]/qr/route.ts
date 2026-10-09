/**
 * QR PAYLOAD — /api/booking/pass/[id]/qr
 * Отдаёт JSON { token, qrData } для сканера. Доступен владельцу брони или ADMIN/SUPPORT.
 * qrData — полный URL вида https://app/check-in?token=... (что именно сканируют).
 */

import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { signPassToken } from '@/server/booking/pass-token';
import { clientEnv } from '@/config/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const caller = await getCaller();
  if (!caller) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const booking = await db.booking.findUnique({
    where: { id },
    select: { id: true, customerId: true, reference: true },
  });
  if (!booking) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  const isOwner = booking.customerId === caller.id;
  const isStaff = caller.role === 'ADMIN' || caller.role === 'SUPPORT';
  if (!isOwner && !isStaff) return Response.json({ error: 'FORBIDDEN' }, { status: 403 });

  const token = signPassToken(booking.id);
  const base = clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const qrData = `${base}/studio/check-in?token=${encodeURIComponent(token)}`;

  return Response.json(
    { token, qrData, reference: booking.reference },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

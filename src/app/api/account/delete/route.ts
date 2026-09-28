/**
 * API: POST /api/account/delete — отложенное удаление (A-10).
 */

import { db } from '@/lib/db';
import { getCaller } from '@/lib/auth/guards';
import { dataRetention } from '@/config/business';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const caller = await getCaller();
  if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const graceDays = dataRetention.accountDeletionGraceDays;
  const requestedAt = new Date();
  await db.user.update({ where: { id: caller.id }, data: { deletionRequestedAt: requestedAt } });
  // Запись согласия не удаляем — D-03: ConsentRecord остаётся.
  return new Response(JSON.stringify({ ok: true, deletionRequestedAt: requestedAt.toISOString(), graceDays }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

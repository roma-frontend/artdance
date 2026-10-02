/**
 * API: POST/DELETE /api/account/delete — отложенное удаление и отзыв (A-10).
 *
 * POST — запросить удаление: ставит `deletionRequestedAt`, деактивирует доступ
 * (гвард `getCaller` пропускает только `isActive`), но не стирает финансовые
 * записи и `ConsentRecord` (D-03). DELETE — отменить: очищает `deletionRequestedAt`,
 * reactivate grace.
 */

import { db } from '@/lib/db';
import { getCaller } from '@/lib/auth/guards';
import { dataRetention } from '@/config/business';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const caller = await getCaller();
  if (!caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const graceDays = dataRetention.accountDeletionGraceDays;
  const requestedAt = new Date();
  const updated = await db.user.update({
    where: { id: caller.id },
    data: { deletionRequestedAt: requestedAt, isActive: false },
    select: { deletionRequestedAt: true },
  });
  // Записи согласия и финансовые документы не удаляем — D-03 / §6 retention.
  void updated;
  return new Response(JSON.stringify({ ok: true, deletionRequestedAt: requestedAt.toISOString(), graceDays }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function DELETE() {
  const caller = await getCaller();
  // Отзыв возможен и при isActive:false — ищем по сессии напрямую, минуя гвард.
  if (!caller) {
    const { auth } = await import('@/lib/auth/auth');
    const { headers } = await import('next/headers');
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id as string | undefined;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    await db.user.update({ where: { id: userId }, data: { deletionRequestedAt: null, isActive: true } });
    return new Response(JSON.stringify({ ok: true, cancelled: true }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  const existing = await db.user.findUnique({ where: { id: caller.id }, select: { deletionRequestedAt: true } });
  if (!existing?.deletionRequestedAt) {
    return new Response(JSON.stringify({ ok: false, error: 'No pending deletion' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  await db.user.update({ where: { id: caller.id }, data: { deletionRequestedAt: null, isActive: true } });
  return new Response(JSON.stringify({ ok: true, cancelled: true }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

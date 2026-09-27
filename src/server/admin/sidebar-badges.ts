import 'server-only';

/**
 * БЕЙДЖИ НЕОТРАБОТАННЫХ ЗАПИСЕЙ В САЙДБАРЕ.
 *
 * Считает количество задач, требующих реакции персонала:
 *  - модерация (отзывы, анкеты инструкторов и залов со статусом PENDING)
 *  - согласования (запросы со статусом PENDING и не истекшим сроком)
 *  - корзина (общее число удаленных элементов)
 *
 * Если прав на просмотр нет или записей 0 — бейдж не выводится.
 */

import type { Capability } from '@/config/capabilities';
import { routes } from '@/config';
import { db } from '@/lib/db';
import { trashCounts } from '@/server/admin/trash';

export async function getSidebarPendingBadges(capabilities: Set<Capability>): Promise<Record<string, number>> {
  const now = new Date();
  const badges: Record<string, number> = {};

  const canModerate = capabilities.has('reviews.moderate');
  const canSettings = capabilities.has('settings.edit');
  const canTrash = capabilities.has('trash.view');

  const [
    pendingReviews,
    pendingInstructors,
    pendingVenues,
    approvals,
    trashMap,
  ] = await Promise.all([
    canModerate ? db.review.count({ where: { moderation: 'PENDING' } }) : null,
    canModerate ? db.instructorProfile.count({ where: { moderation: 'PENDING' } }) : null,
    canModerate ? db.venue.count({ where: { moderation: 'PENDING' } }) : null,
    canSettings
      ? db.approvalRequest.count({ where: { status: 'PENDING', expiresAt: { gt: now } } })
      : null,
    canTrash ? trashCounts() : null,
  ]);

  if (canModerate) {
    const totalModeration = (pendingReviews ?? 0) + (pendingInstructors ?? 0) + (pendingVenues ?? 0);
    if (totalModeration > 0) {
      badges[routes.adminModeration()] = totalModeration;
    }
  }

  if (canSettings && approvals && approvals > 0) {
    badges[routes.adminApprovals()] = approvals;
  }

  if (canTrash && trashMap) {
    const totalTrash = Object.values(trashMap).reduce((sum, count) => sum + count, 0);
    if (totalTrash > 0) {
      badges[routes.adminTrash()] = totalTrash;
    }
  }

  return badges;
}

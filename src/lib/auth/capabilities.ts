/**
 * Разрешение capability: матрица запретов из БД + временные гранты.
 *
 * Порядок разрешения — важен и зафиксирован здесь как единственная реализация:
 *   1. ADMIN → разрешено всегда;
 *   2. роль не участвует в capability-модели → разрешено (владение проверяется
 *      отдельно, см. `guards.ts`);
 *   3. базовый набор роли не содержит capability → запрещено;
 *   4. есть живой временный грант → разрешено;
 *   5. в матрице есть запись `enabled = false` → запрещено;
 *   6. иначе → разрешено.
 */

import 'server-only';

import { db } from '@/lib/db';
import { defaultRoleCapabilities, type Capability } from '@/config/capabilities';
import type { UserRole } from '@/domain/enums';

/** Роли, для которых capability-матрица вообще применяется. */
const MANAGED_ROLES: readonly UserRole[] = ['ADMIN', 'SUPPORT'];

/** Активные гранты роли. Истёкшие не удаляются — их чистит cron, история полезна. */
async function activeGrants(role: UserRole): Promise<Set<string>> {
  const grants = await db.accessGrant.findMany({
    where: { role, expiresAt: { gt: new Date() }, revokedAt: null },
    select: { capability: true },
  });
  return new Set(grants.map((g) => g.capability));
}

async function deniedCapabilities(role: UserRole): Promise<Set<string>> {
  const rows = await db.accessControl.findMany({
    where: { role, enabled: false },
    select: { capability: true },
  });
  return new Set(rows.map((r) => r.capability));
}

export async function hasCapability(role: UserRole, capability: Capability): Promise<boolean> {
  if (role === 'ADMIN') return true;
  if (!MANAGED_ROLES.includes(role)) return true;

  const base = defaultRoleCapabilities[role] ?? [];
  if (!base.includes(capability)) return false;

  const denied = await deniedCapabilities(role);
  if (!denied.has(capability)) return true;

  const granted = await activeGrants(role);
  return granted.has(capability);
}

/**
 * Полный набор прав роли — для рендера навигации админки одним запросом,
 * вместо N проверок по одной capability на пункт меню.
 */
export async function resolveCapabilities(role: UserRole): Promise<Set<Capability>> {
  if (role === 'ADMIN') return new Set(defaultRoleCapabilities.ADMIN);

  const base = defaultRoleCapabilities[role] ?? [];
  if (!MANAGED_ROLES.includes(role)) return new Set(base);

  const [denied, granted] = await Promise.all([deniedCapabilities(role), activeGrants(role)]);
  return new Set(base.filter((cap) => !denied.has(cap) || granted.has(cap)));
}

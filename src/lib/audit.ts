/**
 * AUDIT LOG — журнал административных действий.
 *
 * Три свойства, каждое из которых решает реальную проблему:
 *
 * 1. **Никогда не бросает исключение.** Сбой записи в журнал не должен отменять
 *    успешную бизнес-операцию: иначе падение аудита превращается в отказ
 *    подтверждения оплаченной брони.
 * 2. **Снапшоты `before`/`after`.** Запись становится откатываемой: можно
 *    восстановить состояние без event sourcing всей системы. Один раз —
 *    поле `revertedAt` не даёт откатить повторно.
 * 3. **Критичные действия дублируются оповещением** владельцу платформы.
 *    Список короткий (`criticalAuditActions`), иначе алерты перестают читать.
 *
 * Персональные данные в снапшотах маскируются: журнал читают сотрудники
 * поддержки, а не только владелец.
 */

import 'server-only';

import { criticalAuditActions } from '@/config/security';
import { db } from '@/lib/db';
import type { Caller } from '@/lib/auth/guards';

/** Поля, значения которых никогда не попадают в журнал в открытом виде. */
const MASKED_FIELDS = new Set([
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'secret',
  'apiKey',
  'cardNumber',
  'cvv',
  'accountNumber',
  'twoFactorSecret',
]);

/** Поля, которые маскируются частично — чтобы запись осталась полезной. */
const PARTIAL_FIELDS = new Set(['email', 'phone']);

function maskValue(key: string, value: unknown): unknown {
  if (MASKED_FIELDS.has(key)) return '[redacted]';
  if (PARTIAL_FIELDS.has(key) && typeof value === 'string') {
    if (key === 'email') {
      const [local, domain] = value.split('@');
      if (!local || !domain) return '[redacted]';
      return `${local.slice(0, 2)}***@${domain}`;
    }
    return `***${value.slice(-4)}`;
  }
  return value;
}

function sanitize(input: unknown, depth = 0): unknown {
  if (depth > 4 || input === null || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.slice(0, 50).map((v) => sanitize(v, depth + 1));

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const masked = maskValue(key, value);
    result[key] = masked === value ? sanitize(value, depth + 1) : masked;
  }
  return result;
}

/** Только изменённые поля: полный дамп сущности делает журнал нечитаемым. */
function diffOf(before: unknown, after: unknown): unknown {
  if (
    before === null ||
    after === null ||
    typeof before !== 'object' ||
    typeof after !== 'object'
  ) {
    return { before: sanitize(before), after: sanitize(after) };
  }

  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const changed: Record<string, { before: unknown; after: unknown }> = {};

  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (JSON.stringify(b[key]) === JSON.stringify(a[key])) continue;
    changed[key] = { before: maskValue(key, b[key]), after: maskValue(key, a[key]) };
  }
  return changed;
}

export interface AuditEntry {
  actor: Caller | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const diff =
      entry.before !== undefined || entry.after !== undefined
        ? diffOf(entry.before ?? null, entry.after ?? null)
        : undefined;

    await db.auditLog.create({
      data: {
        actorId: entry.actor?.id ?? null,
        actorRole: entry.actor?.role ?? null,
        /** Email дублируется строкой: журнал остаётся читаемым после удаления аккаунта. */
        actorEmail: entry.actor?.email ?? 'system',
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        diff: diff === undefined ? undefined : (diff as object),
        reason: entry.reason ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (error) {
    /** Аудит не имеет права ронять бизнес-операцию. */
    console.error('[audit] запись не удалась', { action: entry.action, error });
  }

  if ((criticalAuditActions as readonly string[]).includes(entry.action)) {
    void notifyCritical(entry);
  }
}

/**
 * Оповещение о критичном действии. Реализация подключается в фазе уведомлений;
 * до этого — только лог, но точка вызова уже на месте, чтобы её не забыли.
 */
async function notifyCritical(entry: AuditEntry): Promise<void> {
  try {
    console.warn('[audit:critical]', {
      action: entry.action,
      actor: entry.actor?.email ?? 'system',
      entity: `${entry.entityType}:${entry.entityId}`,
    });
    // TODO(phase-notifications): отправка владельцу через Resend/Telegram.
  } catch {
    /* оповещение — best effort */
  }
}

/**
 * Помечает запись журнала как откаченную. Сам откат выполняет вызывающий код:
 * журнал только фиксирует факт и не даёт откатить дважды.
 */
export async function markAuditReverted(auditId: string, actor: Caller): Promise<boolean> {
  const result = await db.auditLog.updateMany({
    where: { id: auditId, revertedAt: null },
    data: { revertedAt: new Date(), revertedById: actor.id },
  });
  return result.count === 1;
}

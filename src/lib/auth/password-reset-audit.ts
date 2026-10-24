/**
 * Аудит смены пароля по ссылке из письма.
 *
 * Токен потребляет better-auth и наружу userId не отдаёт, поэтому владельца
 * токена читаем из `VerificationToken` ДО вызова библиотеки. Идентификатор
 * токена в таблице хранится без хеширования (см. `verification` в `auth.ts`).
 *
 * `recordAudit` не бросает исключений: сбой журнала не отменяет смену пароля.
 */

import 'server-only';

import { recordAudit } from '@/lib/audit';
import { db } from '@/lib/db';

const RESET_PREFIX = 'reset-password:';

/** userId, которому выдан токен сброса, или `null`, если токен неизвестен или истёк. */
export async function userIdForResetToken(token: string): Promise<string | null> {
  const row = await db.verificationToken.findFirst({
    where: { identifier: `${RESET_PREFIX}${token}`, expiresAt: { gt: new Date() } },
    select: { value: true },
  });
  return row?.value ?? null;
}

/** Событие `auth.resetPassword` в журнале. Актора нет: пользователь не вошёл в систему. */
export async function auditPasswordReset(input: {
  userId: string | null;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await recordAudit({
    actor: null,
    action: 'auth.resetPassword',
    entityType: 'user',
    entityId: input.userId ?? 'unknown',
    reason: 'Смена пароля по ссылке из письма',
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}

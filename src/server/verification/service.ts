import 'server-only';

import { recordAudit } from '@/lib/audit';
import type { Caller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { canGoVerified } from '@/domain/verification';

/** Заявка на верификацию: документ создаётся в статусе PENDING и ждёт решения модератора. */
export async function submitVerificationDocument(input: { instructorId: string; type: string; storageKey: string }) {
  const type = input.type.trim();
  const storageKey = input.storageKey.trim();
  if (!type || !storageKey) throw domainErrors.validationFailed(type ? 'storageKey' : 'type');
  return db.verificationDocument.create({
    data: { instructorId: input.instructorId, type, storageKey, status: 'PENDING' },
    select: { id: true },
  });
}

export type VerificationDecision = 'APPROVED' | 'REJECTED';

export interface DecideVerificationInput {
  documentId: string;
  decision: VerificationDecision;
  /** Причина видна инструктору; для отказа её обязательность проверяет действие. */
  note?: string | null;
  actor: Caller;
  ipAddress?: string | null;
}

export interface DecideVerificationResult {
  documentId: string;
  instructorId: string;
  status: VerificationDecision;
  isVerified: boolean;
}

/**
 * Решение модератора по документу (D-02).
 *
 * Статус документа и бейдж `isVerified` меняются в одной транзакции, поэтому бейдж
 * всегда равен `canGoVerified` по всем документам инструктора. `verifiedAt` ставится
 * при первом подтверждении и сбрасывается, когда подтверждённых документов не осталось.
 * Аудит пишется после коммита: сбой журнала не отменяет решение, а откаченная
 * транзакция не оставляет записи о несостоявшемся решении.
 */
export async function decideVerificationDocument(input: DecideVerificationInput): Promise<DecideVerificationResult> {
  const now = new Date();

  const outcome = await db.$transaction(async (tx) => {
    const doc = await tx.verificationDocument.findUnique({
      where: { id: input.documentId },
      select: { id: true, instructorId: true, status: true },
    });
    if (!doc) throw domainErrors.notFound();

    await tx.verificationDocument.update({
      where: { id: doc.id },
      data: { status: input.decision, note: input.note ?? null },
    });

    const docs = await tx.verificationDocument.findMany({
      where: { instructorId: doc.instructorId },
      select: { status: true },
    });
    const isVerified = canGoVerified(docs);

    const profile = await tx.instructorProfile.findUnique({
      where: { id: doc.instructorId },
      select: { isVerified: true, verifiedAt: true },
    });
    if (!profile) throw domainErrors.notFound();

    await tx.instructorProfile.update({
      where: { id: doc.instructorId },
      data: { isVerified, verifiedAt: isVerified ? (profile.verifiedAt ?? now) : null },
    });

    return { doc, profile, isVerified };
  });

  await recordAudit({
    actor: input.actor,
    action: input.decision === 'APPROVED' ? 'admin.verification.approve' : 'admin.verification.reject',
    entityType: 'VerificationDocument',
    entityId: input.documentId,
    before: { status: outcome.doc.status, isVerified: outcome.profile.isVerified },
    after: { status: input.decision, isVerified: outcome.isVerified },
    ...(input.note ? { reason: input.note } : {}),
    ipAddress: input.ipAddress ?? undefined,
  });

  return {
    documentId: input.documentId,
    instructorId: outcome.doc.instructorId,
    status: input.decision,
    isVerified: outcome.isVerified,
  };
}

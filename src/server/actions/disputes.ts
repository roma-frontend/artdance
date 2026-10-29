'use server';

/**
 * DISPUTES — споры по броням (D-08).
 *
 * Открыть спор может участник брони: клиент, инструктор или сотрудник площадки.
 * Решение принимает модератор с правом `dispute.resolve`. Участие, сроки и
 * однократность решения проверяет сервис (`src/server/disputes/service.ts`);
 * здесь — вход, лимит частоты и журнал аудита.
 */

import { z } from 'zod';

import { disputeLengths } from '@/domain/dispute';
import { recordAudit } from '@/lib/audit';
import { openDispute, resolveDispute } from '@/server/disputes/service';
import { authedAction, capabilityAction } from '@/server/safe-action';

const openSchema = z.object({
  bookingId: z.string().min(1).max(64),
  reason: z.string().trim().min(disputeLengths.min).max(disputeLengths.max),
});

/** Открытие спора по броне. Повтор по той же броне отклоняется сервисом. */
export const openDisputeAction = authedAction
  .metadata({ rateLimit: 'disputeOpen', audit: 'dispute.open' })
  .inputSchema(openSchema)
  .action(async ({ parsedInput, ctx }) => {
    const dispute = await openDispute({
      bookingId: parsedInput.bookingId,
      reason: parsedInput.reason,
      openedBy: ctx.caller.id,
    });
    await recordAudit({
      actor: ctx.caller,
      action: 'dispute.open',
      entityType: 'Dispute',
      entityId: dispute.id,
      after: { bookingId: parsedInput.bookingId },
      ipAddress: ctx.identifier,
    });
    return { ok: true as const, id: dispute.id };
  });

const resolveSchema = z.object({
  disputeId: z.string().min(1).max(64),
  winner: z.enum(['CLAIMANT', 'RESPONDENT']),
});

/**
 * Решение по спору. Штраф надёжности и смена статуса проходят в одной
 * транзакции внутри сервиса; повторное решение по уже принятому спору отклоняется.
 */
export const resolveDisputeAction = capabilityAction('dispute.resolve')
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.dispute.resolve' })
  .inputSchema(resolveSchema)
  .action(async ({ parsedInput, ctx }) => {
    const updated = await resolveDispute({ disputeId: parsedInput.disputeId, winner: parsedInput.winner });
    await recordAudit({
      actor: ctx.caller,
      action: 'admin.dispute.resolve',
      entityType: 'Dispute',
      entityId: parsedInput.disputeId,
      after: { status: updated.status, winner: parsedInput.winner },
      ipAddress: ctx.identifier,
    });
    return { ok: true as const, status: updated.status };
  });

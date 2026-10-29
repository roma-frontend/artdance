'use server';

/**
 * VERIFICATION — D-02: загрузка/одобрение документов инструктора.
 */

import { z } from 'zod';

import { requireInstructorProfile } from '@/lib/auth/guards';
import { authedAction, capabilityAction } from '@/server/safe-action';
import { decideVerificationDocument, submitVerificationDocument } from '@/server/verification/service';

const uploadSchema = z.object({ type: z.string().min(1), storageKey: z.string().min(1) });

export const uploadVerificationDoc = authedAction
  .metadata({ rateLimit: 'mediaUpload' })
  .inputSchema(uploadSchema)
  .action(async ({ parsedInput }: { parsedInput: z.infer<typeof uploadSchema> }) => {
    /* Владелец — из сессии: клиентский instructorId не принимаем, иначе документ привязывается к чужому профилю. */
    const { instructorId } = await requireInstructorProfile();
    const doc = await submitVerificationDocument({ instructorId, type: parsedInput.type, storageKey: parsedInput.storageKey });
    return { id: doc.id };
  });

/* Одобрение — только с правом модерации контента; статус и бейдж меняет сервис верификации. */
export const approveVerificationDoc = capabilityAction('content.moderate')
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.verification.approve' })
  .inputSchema(z.object({ id: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    await decideVerificationDocument({ documentId: parsedInput.id, decision: 'APPROVED', actor: ctx.caller, ipAddress: ctx.identifier });
    return { ok: true as const };
  });

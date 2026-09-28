'use server';

/**
 * VERIFICATION — D-02: загрузка/одобрение документов инструктора.
 */

import { z } from 'zod';

import { db } from '@/lib/db';
import { authedAction } from '@/server/safe-action';

const uploadSchema = z.object({ instructorId: z.string().min(1), type: z.string().min(1), storageKey: z.string().min(1) });

export const uploadVerificationDoc = authedAction
  .metadata({ rateLimit: 'mediaUpload' })
  .inputSchema(uploadSchema)
  .action(async ({ parsedInput }: { parsedInput: z.infer<typeof uploadSchema> }) => {
    const doc = await db.verificationDocument.create({
      data: { instructorId: parsedInput.instructorId, type: parsedInput.type, storageKey: parsedInput.storageKey, status: 'PENDING' },
      select: { id: true },
    });
    return { id: doc.id };
  });

export const approveVerificationDoc = authedAction
  .metadata({ rateLimit: 'adminMutation' })
  .inputSchema(z.object({ id: z.string().min(1) }))
  .action(async ({ parsedInput }: { parsedInput: { id: string } }) => {
    await db.verificationDocument.update({ where: { id: parsedInput.id }, data: { status: 'APPROVED' } });
    return { ok: true as const };
  });

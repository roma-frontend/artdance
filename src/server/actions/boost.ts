'use server';

/**
 * БУСТ ИНСТРУКТОРА — заявка на промо-размещение из кабинета студии.
 *
 * Профиль берётся из сессии (`requireInstructorProfile`), поэтому заявку создать
 * можно только для себя. Заявка ждёт модерации: до одобрения размещения нет.
 */

import { z } from 'zod';

import { requireInstructorProfile } from '@/lib/auth/guards';
import { createBoost } from '@/server/boost/service';
import { authedAction } from '@/server/safe-action';

export const requestBoost = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'instructor.boost.request' })
  .inputSchema(
    z.object({
      bidAmount: z.number().int(),
      startsAt: z.coerce.date(),
      endsAt: z.coerce.date(),
    }),
  )
  .action(async ({ parsedInput }): Promise<{ id: string }> => {
    const { instructorId } = await requireInstructorProfile();
    const campaign = await createBoost({ instructorId, ...parsedInput });
    return { id: campaign.id };
  });

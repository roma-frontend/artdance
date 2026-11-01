'use server';

/**
 * РЕЗУЛЬТАТЫ СОРЕВНОВАНИЙ — админ записывает место атлета по утверждённой регистрации.
 * Место не влияет на деньги, поэтому отдельного согласования нет; действие пишет аудит.
 */

import { z } from 'zod';

import { competitionPlaces } from '@/domain/athlete-rating';
import { recordAudit } from '@/lib/audit';
import { requireCapability } from '@/lib/auth/guards';
import { recordCompetitionResult } from '@/server/athlete/results';
import { authedAction } from '@/server/safe-action';

export const recordCompetitionResultAction = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.competition.result.record' })
  .inputSchema(
    z.object({
      registrationId: z.string().trim().min(1).max(64),
      place: z.enum(competitionPlaces),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<{ id: string }> => {
    const caller = await requireCapability('content.manage');
    const result = await recordCompetitionResult({
      registrationId: parsedInput.registrationId,
      place: parsedInput.place,
      recordedById: caller.id,
    });

    await recordAudit({
      actor: caller,
      action: 'admin.competition.result.record',
      entityType: 'CompetitionResult',
      entityId: result.id,
      after: { place: result.place, registrationId: parsedInput.registrationId },
      ipAddress: ctx.identifier,
    });

    return { id: result.id };
  });

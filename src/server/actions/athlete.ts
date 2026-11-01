'use server';

/**
 * ПРОФИЛЬ АТЛЕТА — сохранение программ, клуба и разряда.
 *
 * Личность берётся из сессии: `userId` в аргументах не принимается, иначе профиль
 * чужого атлета можно было бы переписать. Действие пишет в журнал аудита.
 */

import { athleteProfileSchema } from '@/domain/athlete';
import { updateAthleteProfile } from '@/server/athlete/service';
import { authedAction } from '@/server/safe-action';

export const updateAthleteProfileAction = authedAction
  .metadata({ rateLimit: 'dancerProfile', audit: 'athlete.profile.update' })
  .inputSchema(athleteProfileSchema)
  .action(async ({ parsedInput, ctx }) => {
    return updateAthleteProfile(ctx.caller.id, parsedInput);
  });

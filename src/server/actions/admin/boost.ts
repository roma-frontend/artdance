'use server';

/**
 * МОДЕРАЦИЯ БУСТОВ — одобрение или отклонение заявки инструктора на промо-размещение.
 *
 * Одобрение поднимает срок размещения инструктора в выдаче (см. `approveBoost`).
 * Действие пишет в журнал аудита: кто и когда одобрил кампанию.
 */

import { z } from 'zod';

import { requireCapability } from '@/lib/auth/guards';
import { recordAudit } from '@/lib/audit';
import { approveBoost, rejectBoost } from '@/server/boost/service';
import { authedAction } from '@/server/safe-action';

export const moderateBoost = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.boost.moderate' })
  .inputSchema(
    z.object({
      id: z.string().trim().min(1).max(64),
      approve: z.boolean(),
    }),
  )
  .action(async ({ parsedInput, ctx }): Promise<{ status: 'APPROVED' | 'REJECTED' }> => {
    const caller = await requireCapability('boost.manage');
    const status = parsedInput.approve ? 'APPROVED' : 'REJECTED';

    if (parsedInput.approve) await approveBoost(parsedInput.id);
    else await rejectBoost(parsedInput.id);

    await recordAudit({
      actor: caller,
      action: 'admin.boost.moderate',
      entityType: 'BoostCampaign',
      entityId: parsedInput.id,
      after: { status },
      ipAddress: ctx.identifier,
    });

    return { status };
  });

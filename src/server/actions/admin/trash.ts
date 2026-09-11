'use server';

/**
 * ДЕЙСТВИЯ КОРЗИНЫ — вернуть и стереть навсегда.
 *
 * Переноса В корзину здесь нет: это `deleteAdminResource` из `resource.ts`. Оно и
 * раньше было удалением, и с точки зрения администратора ничего не изменилось —
 * изменилось только то, что теперь это отменимо.
 *
 * Два права вместо одного. Вернуть чужое решение и стереть запись навсегда — разные
 * полномочия: у первого есть откат (удалить снова), у второго нет никакого.
 * Поэтому `trash.purge` ещё и нельзя выдать временным грантом.
 *
 * Оба действия пишутся в аудит. Вопрос «кто вернул удалённое занятие» задают ровно
 * так же часто, как «кто его удалил», и ответ должен быть в одном журнале.
 */

import { updateTag } from 'next/cache';
import { z } from 'zod';

import { adminResources, type AdminResource } from '@/config/routes';
import { domainErrors } from '@/domain/errors';
import { recordAudit } from '@/lib/audit';
import { requireCapability } from '@/lib/auth/guards';
import { resourceCacheTags } from '@/server/admin/registry';
import {
  isTrashableResource,
  purgeFromTrash,
  restoreFromTrash,
  trashedSnapshot,
} from '@/server/admin/trash';
import { authedAction } from '@/server/safe-action';

const trashInput = z.object({
  resource: z.enum(adminResources),
  id: z.string().trim().min(1).max(64),
});

function revalidate(resource: AdminResource): void {
  for (const tag of resourceCacheTags(resource)) updateTag(tag);
}

export const restoreAdminResource = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.trash.restore' })
  .inputSchema(trashInput)
  .action(async ({ parsedInput, ctx }): Promise<{ restored: true }> => {
    const caller = await requireCapability('trash.restore');

    if (!isTrashableResource(parsedInput.resource)) throw domainErrors.validationFailed('resource');

    /*
     * Запись обязана быть именно В корзине. Без этой проверки «восстановление»
     * живой записи прошло бы успешно и записалось в аудит как событие, которого
     * не было, — а `update` фильтром корзины не ограничен.
     */
    const before = await trashedSnapshot(parsedInput.resource, parsedInput.id);
    if (!before) throw domainErrors.notFound();

    await restoreFromTrash(parsedInput.resource, parsedInput.id);

    await recordAudit({
      actor: caller,
      action: `admin.${parsedInput.resource}.restore`,
      entityType: parsedInput.resource,
      entityId: parsedInput.id,
      before,
      ipAddress: ctx.identifier,
    });

    revalidate(parsedInput.resource);
    return { restored: true };
  });

export const purgeAdminResource = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.trash.purge' })
  .inputSchema(trashInput)
  .action(async ({ parsedInput, ctx }): Promise<{ purged: true }> => {
    const caller = await requireCapability('trash.purge');

    if (!isTrashableResource(parsedInput.resource)) throw domainErrors.validationFailed('resource');

    const before = await trashedSnapshot(parsedInput.resource, parsedInput.id);
    if (!before) throw domainErrors.notFound();

    /*
     * Аудит пишется ДО удаления. После него читать нечего, а запись в журнал —
     * единственный след, который от записи останется.
     */
    await recordAudit({
      actor: caller,
      action: `admin.${parsedInput.resource}.purge`,
      entityType: parsedInput.resource,
      entityId: parsedInput.id,
      before,
      ipAddress: ctx.identifier,
    });

    await purgeFromTrash(parsedInput.resource, parsedInput.id);

    revalidate(parsedInput.resource);
    return { purged: true };
  });

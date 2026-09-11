'use server';

/**
 * ДЕЙСТВИЯ РЕСУРСА АДМИНКИ — создать, изменить, удалить, массовое действие.
 *
 * Четыре действия на четырнадцать разделов, а не пятьдесят шесть. Разница между
 * «сохранить занятие» и «сохранить товар» — в схеме проверки и в таблице записи,
 * и то и другое уже описано данными (`adminResourceSpecs`, реестр). Пятьдесят
 * шесть почти одинаковых экспортов означали бы пятьдесят шесть мест, где можно
 * забыть гвард, аудит или сброс кеша — и один забытый будет тем, который правит
 * цены.
 *
 * **Право проверяется по ресурсу, а не по имени действия.** `capabilityAction`
 * принимает конкретное право в момент объявления, а нужное право известно только
 * из аргументов, поэтому здесь `authedAction` и первой строкой —
 * `requireCapability(spec.edit)`. Гвард на месте, только вычисляется на строку
 * позже; альтернатива — четырнадцать копий каждого действия.
 *
 * **Аудит обязателен.** Снимок до и после операции пишется `recordAudit`: это
 * единственный способ ответить на вопрос «кто поменял цену занятия во вторник».
 * `metadata.audit` даёт имя события, `entityType` — модель.
 *
 * **Кеш сбрасывается тегами ресурса.** Публичный каталог живёт 180–300 секунд, и
 * без сброса администратор правит цену второй раз, потому что не увидел первую.
 */

import { updateTag } from 'next/cache';
import { z } from 'zod';

import { adminResourceSpecs } from '@/config/admin';
import { security } from '@/config/business';
import { adminResources } from '@/config/routes';
import { buildResourceSchema } from '@/domain/admin/schema';
import { domainErrors } from '@/domain/errors';
import { recordAudit } from '@/lib/audit';
import { requireCapability } from '@/lib/auth/guards';
import {
  createResource,
  deleteResource,
  resourceCacheTags,
  resourceSnapshot,
  updateResource,
} from '@/server/admin/registry';
import { authedAction } from '@/server/safe-action';

/**
 * Значение поля формы. Проверяется схемой ресурса на следующем шаге, поэтому
 * здесь достаточно «сериализуемое»: строгая схема известна только после того, как
 * стал известен ресурс.
 */
const fieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

const resourceSchema = z.enum(adminResources);

const saveInput = z.object({
  resource: resourceSchema,
  /** Пусто — создание новой записи. */
  id: z.string().trim().max(64).optional(),
  values: z.record(z.string(), fieldValueSchema),
});

const deleteInput = z.object({
  resource: resourceSchema,
  id: z.string().trim().min(1).max(64),
});

const bulkActions = ['activate', 'deactivate', 'publish', 'unpublish', 'delete'] as const;

const bulkInput = z.object({
  resource: resourceSchema,
  action: z.enum(bulkActions),
  ids: z.array(z.string().trim().min(1).max(64)).min(1),
});

export type AdminBulkAction = (typeof bulkActions)[number];

export interface SaveResourceOutcome {
  id: string;
  created: boolean;
}

/* ─────────────────────────────── Сохранение ─────────────────────────────── */

export const saveAdminResource = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.resource.save' })
  .inputSchema(saveInput)
  .action(async ({ parsedInput, ctx }): Promise<SaveResourceOutcome> => {
    const spec = adminResourceSpecs[parsedInput.resource];
    const caller = await requireCapability(spec.edit);

    /*
     * Вторая проверка — по описанию полей ресурса. Первая схема пропускает любой
     * объект: до разбора аргументов неизвестно, какой это раздел.
     */
    const parsed = buildResourceSchema(spec).safeParse(parsedInput.values);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw domainErrors.validationFailed(first?.path.map(String).join('.'));
    }

    const values = parsed.data;

    if (parsedInput.id) {
      const before = await resourceSnapshot(parsedInput.resource, parsedInput.id);
      if (!before) throw domainErrors.notFound();

      await updateResource(parsedInput.resource, parsedInput.id, values);
      const after = await resourceSnapshot(parsedInput.resource, parsedInput.id);

      await recordAudit({
        actor: caller,
        action: `admin.${parsedInput.resource}.update`,
        entityType: parsedInput.resource,
        entityId: parsedInput.id,
        before,
        after,
        ipAddress: ctx.identifier,
      });

      revalidate(parsedInput.resource);
      return { id: parsedInput.id, created: false };
    }

    const id = await createResource(parsedInput.resource, values);
    const after = await resourceSnapshot(parsedInput.resource, id);

    await recordAudit({
      actor: caller,
      action: `admin.${parsedInput.resource}.create`,
      entityType: parsedInput.resource,
      entityId: id,
      after,
      ipAddress: ctx.identifier,
    });

    revalidate(parsedInput.resource);
    return { id, created: true };
  });

/* ─────────────────────────────── Удаление ─────────────────────────────── */

export const deleteAdminResource = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.resource.delete' })
  .inputSchema(deleteInput)
  .action(async ({ parsedInput, ctx }): Promise<{ deleted: true }> => {
    const spec = adminResourceSpecs[parsedInput.resource];
    /* Удаление медиа требует своего права: снести фотографию проще, чем вернуть. */
    const caller = await requireCapability(spec.remove ?? spec.edit);

    const before = await resourceSnapshot(parsedInput.resource, parsedInput.id);
    if (!before) throw domainErrors.notFound();

    await deleteResource(parsedInput.resource, parsedInput.id);

    await recordAudit({
      actor: caller,
      action: `admin.${parsedInput.resource}.delete`,
      entityType: parsedInput.resource,
      entityId: parsedInput.id,
      before,
      ipAddress: ctx.identifier,
    });

    revalidate(parsedInput.resource);
    return { deleted: true };
  });

/* ──────────────────────────── Массовое действие ──────────────────────────── */

export interface BulkOutcome {
  affected: number;
}

export const runAdminBulkAction = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.resource.bulk' })
  .inputSchema(bulkInput)
  .action(async ({ parsedInput, ctx }): Promise<BulkOutcome> => {
    const spec = adminResourceSpecs[parsedInput.resource];
    const capability = parsedInput.action === 'delete' ? (spec.remove ?? spec.edit) : spec.edit;
    const caller = await requireCapability(capability);

    /* Массовое действие — отдельное право: одним нажатием меняются десятки записей. */
    await requireCapability('action.bulk');

    /*
     * Ограничение сверху — из `security.guardrails`, а не из интерфейса: запрос
     * можно отправить curl'ом, минуя таблицу с чекбоксами.
     */
    if (parsedInput.ids.length > security.guardrails.maxBulkActionItems) {
      throw domainErrors.validationFailed('ids');
    }

    let affected = 0;

    for (const id of parsedInput.ids) {
      const before = await resourceSnapshot(parsedInput.resource, id);
      if (!before) continue;

      if (parsedInput.action === 'delete') {
        await deleteResource(parsedInput.resource, id);
      } else {
        await applyFlag(parsedInput.resource, id, parsedInput.action);
      }

      await recordAudit({
        actor: caller,
        action: `admin.${parsedInput.resource}.${parsedInput.action}`,
        entityType: parsedInput.resource,
        entityId: id,
        before,
        after: parsedInput.action === 'delete' ? undefined : await resourceSnapshot(parsedInput.resource, id),
        ipAddress: ctx.identifier,
      });

      affected += 1;
    }

    revalidate(parsedInput.resource);
    return { affected };
  });

/* ──────────────────────────────── Помощники ──────────────────────────────── */

/**
 * Сброс кеша каталога после мутации.
 *
 * `updateTag`, а не `revalidateTag`, и это важно именно в админке. В Next 16
 * `revalidateTag(tag, profile)` помечает данные устаревшими, разрешая отдавать
 * старый ответ до истечения профиля; `updateTag` истекает немедленно и
 * предназначен для server actions — то есть даёт «прочитать своё изменение».
 * Администратор, сохранивший цену и увидевший старую, идёт править её второй раз.
 *
 * Теги — только из `cacheTags` (через `resourceCacheTags`), строк здесь нет.
 */
function revalidate(resource: (typeof adminResources)[number]): void {
  for (const tag of resourceCacheTags(resource)) updateTag(tag);
}

/**
 * Переключение флага записи без формы. Через реестр не идёт: там значения
 * собираются из полного описания формы, а массовое действие меняет одно поле, и
 * пропускать через него весь набор полей значит рисковать перезаписать чужие
 * правки значениями, которых в запросе не было.
 */
async function applyFlag(
  resource: (typeof adminResources)[number],
  id: string,
  action: Exclude<AdminBulkAction, 'delete'>,
): Promise<void> {
  const { db } = await import('@/lib/db');
  const spec = adminResourceSpecs[resource];

  const value = action === 'activate' || action === 'publish';

  switch (spec.statusFilter) {
    case 'active':
      if (action === 'publish' || action === 'unpublish') throw domainErrors.validationFailed('action');
      break;
    case 'published':
      if (action === 'activate' || action === 'deactivate') throw domainErrors.validationFailed('action');
      break;
    case 'moderation':
    case 'none':
      throw domainErrors.validationFailed('action');
  }

  const data = spec.statusFilter === 'active' ? { isActive: value } : { isPublished: value };

  switch (resource) {
    case 'classes':
      await db.danceClass.update({ where: { id }, data: data as { isActive: boolean } });
      return;
    case 'rooms':
      await db.room.update({ where: { id }, data: data as { isActive: boolean } });
      return;
    case 'products':
      await db.product.update({ where: { id }, data: data as { isActive: boolean } });
      return;
    case 'categories':
      await db.productCategory.update({ where: { id }, data: data as { isActive: boolean } });
      return;
    case 'variants':
      await db.productVariant.update({ where: { id }, data: data as { isActive: boolean } });
      return;
    case 'promo-codes':
      await db.promoCode.update({ where: { id }, data: data as { isActive: boolean } });
      return;
    case 'events':
      await db.event.update({ where: { id }, data: data as { isPublished: boolean } });
      return;
    case 'courses':
      await db.course.update({ where: { id }, data: data as { isPublished: boolean } });
      return;
    default:
      throw domainErrors.validationFailed('action');
  }
}

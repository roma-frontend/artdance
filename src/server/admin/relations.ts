import 'server-only';

/**
 * Варианты для полей-связей раздела.
 *
 * Один проход по описанию полей вместо перечисления вручную на каждом экране:
 * забытое поле дало бы пустой селект без объяснения, и администратор решил бы,
 * что связанных записей нет.
 */

import type { AdminOption, AdminResourceSpec } from '@/config/admin';
import { relationOptions } from '@/server/admin/registry';

export async function loadRelationOptions(
  spec: AdminResourceSpec,
): Promise<Record<string, readonly AdminOption[]>> {
  const entries = await Promise.all(
    spec.fields
      .filter((field) => field.kind === 'relation' && field.relation !== undefined)
      .map(async (field) => {
        const source = field.relation;
        if (source === undefined) return [field.name, [] as readonly AdminOption[]] as const;
        return [field.name, await relationOptions(source)] as const;
      }),
  );

  return Object.fromEntries(entries);
}

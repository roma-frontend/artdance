'use server';

/**
 * Импорт CSV для ресурсов админки (E-03).
 *
 * Парсинг на клиенте — для предпросмотра; здесь повторная проверка + запись.
 * Ничего не применяется частично: при хотя бы одной ошибке строки запись не
 * начинается. Лимит строк — security.guardrails.maxBulkActionItems.
 */

import { z } from 'zod';

import { adminResourceSpecs } from '@/config/admin';
import { security } from '@/config/business';
import { adminResources } from '@/config/routes';
import { buildResourceSchema } from '@/domain/admin/schema';
import { domainErrors } from '@/domain/errors';
import { requireCapability } from '@/lib/auth/guards';
import { parseCsv } from '@/lib/files/csv';
import { createResource } from '@/server/admin/registry';
import { authedAction } from '@/server/safe-action';

const importInput = z.object({
  resource: z.enum(adminResources),
  csvText: z.string().min(1).max(2_000_000),
});

export interface CsvImportOutcome {
  imported: number;
  skipped: number;
  errors: readonly { line: number; issues: readonly string[] }[];
}

export const importAdminCsv = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.resource.csvImport' })
  .inputSchema(importInput)
  .action(async ({ parsedInput }): Promise<CsvImportOutcome> => {
    const spec = adminResourceSpecs[parsedInput.resource];
    await requireCapability(spec.edit);

    const schema = buildResourceSchema(spec);
    const { rows, errors } = parseCsv(parsedInput.csvText, schema);

    if (rows.length > security.guardrails.maxBulkActionItems) {
      throw domainErrors.validationFailed('ids');
    }

    if (errors.length > 0) {
      return { imported: 0, skipped: rows.length, errors };
    }

    let imported = 0;
    for (const values of rows) {
      await createResource(parsedInput.resource, values as never);
      imported += 1;
    }

    return { imported, skipped: 0, errors: [] };
  });

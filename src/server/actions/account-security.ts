'use server';

/**
 * БЕЗОПАСНОСТЬ АККАУНТА: выход с других устройств и резервные коды.
 *
 * Оба действия делегируют Better Auth. Пароль для резервных кодов проверяет
 * библиотека; здесь только перевод её ошибок в ключи нашего словаря.
 */

import { APIError } from 'better-auth/api';
import { headers } from 'next/headers';
import { z } from 'zod';

import { DomainError, domainErrors } from '@/domain/errors';
import { auth } from '@/lib/auth/auth';
import { authedAction } from '@/server/safe-action';

/** Закрывает все сессии, кроме текущей. Текущая остаётся, иначе человек выходит сам. */
export const signOutOtherDevicesAction = authedAction
  .metadata({ rateLimit: 'signIn' })
  .action(async () => {
    try {
      await auth.api.revokeOtherSessions({ headers: await headers() });
    } catch (error) {
      throw domainErrors.internal(error);
    }
    return { done: true };
  });

const passwordSchema = z.object({ password: z.string().min(1).max(128) });

/**
 * Новые резервные коды. Старые становятся недействительными. Коды возвращаются
 * только в этом ответе: в базе они хранятся зашифрованными, и повторно их не показать.
 */
export const generateBackupCodesAction = authedAction
  .metadata({ rateLimit: 'otpVerify' })
  .inputSchema(passwordSchema)
  .action(async ({ parsedInput }) => {
    try {
      const result = await auth.api.generateBackupCodes({
        body: { password: parsedInput.password },
        headers: await headers(),
      });
      return { codes: result.backupCodes };
    } catch (error) {
      if (error instanceof APIError) {
        if (error.body?.code === 'INVALID_PASSWORD') {
          throw new DomainError({
            code: 'UNAUTHORIZED',
            messageKey: 'account.security.backupWrongPassword',
          });
        }
        throw domainErrors.internal(error);
      }
      throw error;
    }
  });

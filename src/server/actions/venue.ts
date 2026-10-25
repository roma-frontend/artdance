'use server';

/**
 * ДЕЙСТВИЕ НАЗНАЧЕНИЯ ЗАЛА ЗАНЯТИЮ.
 *
 * Круг прав и проверки конфликтов живут в `assignClassSessionRoom`. Здесь только
 * вход и маппинг ошибок в состояние формы: доменная ошибка отдаёт свой ключ
 * сообщения, остальное — общий текст.
 */

import { z } from 'zod';

import { isDomainError } from '@/domain/errors';
import type { MessageKey } from '@/i18n/types';
import { authedAction } from '@/server/safe-action';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { assignClassSessionRoom } from '@/server/venue/room-assignment';

export interface VenueRoomActionState {
  status: 'idle' | 'success' | 'error';
  messageKey?: MessageKey;
  /** Поле, названное доменной ошибкой. */
  field?: string;
}

const assignInput = z.object({
  sessionId: z.string().trim().min(1).max(64),
  roomId: z.string().trim().min(1).max(64).nullable(),
});

export const assignSessionRoom = authedAction
  .metadata({ rateLimit: 'adminMutation' })
  .inputSchema(assignInput)
  .action(async ({ parsedInput }): Promise<VenueRoomActionState> => {
    try {
      await assertEntitlementOrThrow('events');
      await assignClassSessionRoom(parsedInput);
      return { status: 'success', messageKey: 'footer.venueDashboardRoomSaved' as MessageKey };
    } catch (error) {
      if (isDomainError(error)) return { status: 'error', messageKey: error.messageKey as MessageKey, field: error.field };
      return { status: 'error', messageKey: 'footer.venueDashboardRoomError' as MessageKey };
    }
  });

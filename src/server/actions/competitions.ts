'use server';

import { z } from 'zod';
import { updateTag } from 'next/cache';

import { isDomainError } from '@/domain/errors';
import type { MessageKey } from '@/i18n/types';
import { requireCaller } from '@/lib/auth/guards';
import { cacheTags } from '@/config/cache';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { parseBirthDate, registerForCompetition } from '@/server/events/register';

export interface CompetitionRegistrationState {
  status: 'idle' | 'success' | 'error';
  messageKey?: MessageKey;
}

const registrationSchema = z.object({
  eventSlug: z.string().trim().min(1).max(160),
  categoryId: z.string().trim().min(1).max(64),
  birthDate: z.string().trim().min(1).max(32),
  partnerName: z.string().trim().max(160).optional(),
});

export async function submitCompetitionRegistration(
  _previous: CompetitionRegistrationState,
  formData: FormData,
): Promise<CompetitionRegistrationState> {
  try {
    /* Выключенный модуль событий не принимает регистрации, даже из прямого вызова действия. */
    await assertEntitlementOrThrow('events');
    const caller = await requireCaller();
    const parsed = registrationSchema.safeParse({
      eventSlug: formData.get('eventSlug'),
      categoryId: formData.get('categoryId'),
      birthDate: formData.get('birthDate'),
      partnerName: formData.get('partnerName') || undefined,
    });
    if (!parsed.success) return { status: 'error', messageKey: 'events.registrationError' as MessageKey };

    const birthDate = parseBirthDate(parsed.data.birthDate);
    if (!birthDate) return { status: 'error', messageKey: 'events.registrationError' as MessageKey };

    await registerForCompetition({
      userId: caller.id,
      eventSlug: parsed.data.eventSlug,
      categoryId: parsed.data.categoryId,
      birthDate,
      partnerName: parsed.data.partnerName || null,
    });
    updateTag(cacheTags.events());
    return { status: 'success', messageKey: 'events.registrationSuccess' as MessageKey };
  } catch (error) {
    if (isDomainError(error)) return { status: 'error', messageKey: error.messageKey as MessageKey };
    return { status: 'error', messageKey: 'events.registrationError' as MessageKey };
  }
}

'use server';

import { z } from 'zod';
import { updateTag } from 'next/cache';

import { ageFitsCategory, registrationIsOpen } from '@/domain/competition';
import { isDomainError } from '@/domain/errors';
import type { MessageKey } from '@/i18n/types';
import { db } from '@/lib/db';
import { requireCaller } from '@/lib/auth/guards';
import { cacheTags } from '@/config/cache';

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
    const caller = await requireCaller();
    const parsed = registrationSchema.safeParse({
      eventSlug: formData.get('eventSlug'),
      categoryId: formData.get('categoryId'),
      birthDate: formData.get('birthDate'),
      partnerName: formData.get('partnerName') || undefined,
    });
    if (!parsed.success) return { status: 'error', messageKey: 'events.registrationError' as MessageKey };

    const birthDate = new Date(`${parsed.data.birthDate}T00:00:00.000Z`);
    if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) {
      return { status: 'error', messageKey: 'events.registrationError' as MessageKey };
    }

    const result = await db.$transaction(async (tx) => {
      const event = await tx.event.findFirst({
        where: { slug: parsed.data.eventSlug, isPublished: true, type: 'COMPETITION' },
        select: {
          id: true,
          startsAt: true,
          registrationOpenAt: true,
          registrationCloseAt: true,
        },
      });
      if (!event || !registrationIsOpen(new Date(), { openAt: event.registrationOpenAt, closeAt: event.registrationCloseAt })) {
        throw new Error('REGISTRATION_CLOSED');
      }

      const category = await tx.competitionCategory.findFirst({
        where: { id: parsed.data.categoryId, eventId: event.id, isActive: true },
        select: { id: true, minAge: true, maxAge: true, maxEntries: true },
      });
      if (!category) throw new Error('CATEGORY_NOT_FOUND');
      if (!ageFitsCategory(birthDate, event.startsAt, category)) throw new Error('AGE_NOT_ELIGIBLE');

      const athlete = await tx.athleteProfile.upsert({
        where: { userId: caller.id },
        create: { userId: caller.id, birthDate },
        update: { birthDate },
        select: { id: true },
      });
      await tx.user.update({ where: { id: caller.id }, data: { role: 'ATHLETE' } });

      const existing = await tx.competitionRegistration.findUnique({
        where: {
          eventId_categoryId_athleteProfileId: {
            eventId: event.id,
            categoryId: category.id,
            athleteProfileId: athlete.id,
          },
        },
        select: { status: true },
      });
      if (existing && existing.status !== 'CANCELLED') throw new Error('ALREADY_REGISTERED');

      if (category.maxEntries !== null) {
        const occupied = await tx.competitionRegistration.count({
          where: { categoryId: category.id, status: { in: ['PENDING', 'APPROVED'] } },
        });
        if (occupied >= category.maxEntries) throw new Error('CATEGORY_FULL');
      }

      const data = {
        eventId: event.id,
        categoryId: category.id,
        athleteProfileId: athlete.id,
        partnerName: parsed.data.partnerName || null,
        status: 'PENDING' as const,
      };

      if (existing) {
        return tx.competitionRegistration.update({
          where: {
            eventId_categoryId_athleteProfileId: {
              eventId: event.id,
              categoryId: category.id,
              athleteProfileId: athlete.id,
            },
          },
          data,
          select: { id: true },
        });
      }
      return tx.competitionRegistration.create({ data, select: { id: true } });
    });

    void result;
    updateTag(cacheTags.events());
    return { status: 'success', messageKey: 'events.registrationSuccess' as MessageKey };
  } catch (error) {
    if (isDomainError(error)) return { status: 'error', messageKey: error.messageKey as MessageKey };
    return { status: 'error', messageKey: 'events.registrationError' as MessageKey };
  }
}

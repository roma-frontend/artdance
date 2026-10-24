'use server';

/**
 * ДЕЙСТВИЯ РАСПИСАНИЯ ИНСТРУКТОРА.
 *
 * Расписание (правила недельного окна и исключения) принадлежит инструктору:
 * круг редактирования — только строки со СВОИМ `instructorId`. Админ правит
 * каталог и модерацию, а не личное время преподавателя — это правило
 * фиксирует `requireInstructorProfile()`: без привязанного профиля действие
 * падает `FORBIDDEN`, а поле `instructorId` из формы игнорируется намеренно.
 *
 * Кеш публичного каталога после правки сбрасывается тегами инструктора:
 * календарь на `/instructors/[slug]/book` и API доступности читают эти же
 * строки из базы.
 */

import { updateTag } from 'next/cache';
import { z } from 'zod';

import { cacheTags } from '@/config/cache';
import { domainErrors, isDomainError } from '@/domain/errors';
import type { MessageKey } from '@/i18n/types';
import { requireInstructorProfile } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { authedAction } from '@/server/safe-action';
import {
  scheduleExceptionSchema,
  scheduleInstant,
  scheduleRuleSchema,
  windowsOverlap,
} from '@/domain/availability/schedule';

export interface AvailabilityActionState {
  status: 'idle' | 'success' | 'error';
  messageKey?: MessageKey;
  /** Поле, названное неверным схемой. */
  field?: string;
}

const ruleInput = scheduleRuleSchema;
const exceptionInput = scheduleExceptionSchema;

const deleteInput = z.object({
  table: z.enum(['rule', 'exception']),
  id: z.string().trim().min(1).max(64),
});

const toggleInput = z.object({
  id: z.string().trim().min(1).max(64),
  isActive: z.boolean(),
});

/** Смит-инвариант: не дать сохранить правило с пересекающимися окнами того же дня. */
async function assertNoSameDayOverlap(
  instructorId: string,
  weekday: number,
  startTime: string,
  endTime: string,
  excludeId?: string,
): Promise<void> {
  const sameDay = await db.availabilityRule.findMany({
    where: { instructorId, weekday, isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { startTime: true, endTime: true },
  });
  const overlap = sameDay.some(
    (row) => row.startTime !== endTime && row.endTime !== startTime && windowsOverlap(row.startTime, row.endTime, startTime, endTime),
  );
  if (overlap) throw domainErrors.validationFailed('overlap');
}

/* ─────────────────────────── Правила (недельное окно) ─────────────────────────── */

export const saveAvailabilityRule = authedAction
  .metadata({ rateLimit: 'adminMutation' })
  .inputSchema(ruleInput)
  .action(async ({ parsedInput }): Promise<AvailabilityActionState> => {
    try {
      const { instructorId } = await requireInstructorProfile();

      const validFrom = parsedInput.validFrom ? new Date(`${parsedInput.validFrom}T00:00:00.000Z`) : null;
      const validUntil = parsedInput.validUntil ? new Date(`${parsedInput.validUntil}T23:59:59.000Z`) : null;
      if (validFrom && validUntil && validFrom > validUntil) {
        return { status: 'error', field: 'validFrom', messageKey: 'studio.availability.errorDateOrder' as MessageKey };
      }

      await assertNoSameDayOverlap(instructorId, parsedInput.weekday, parsedInput.startTime, parsedInput.endTime, parsedInput.id);

      if (parsedInput.id) {
        const updated = await db.availabilityRule.updateMany({
          where: { id: parsedInput.id, instructorId },
          data: {
            weekday: parsedInput.weekday,
            startTime: parsedInput.startTime,
            endTime: parsedInput.endTime,
            validFrom,
            validUntil,
            isActive: parsedInput.isActive,
          },
        });
        if (updated.count !== 1) throw domainErrors.notFound();
      } else {
        await db.availabilityRule.create({
          data: {
            instructorId,
            weekday: parsedInput.weekday,
            startTime: parsedInput.startTime,
            endTime: parsedInput.endTime,
            validFrom,
            validUntil,
            isActive: parsedInput.isActive,
          },
        });
      }

      updateTag(cacheTags.instructors());
      return { status: 'success', messageKey: 'studio.availability.saved' as MessageKey };
    } catch (error) {
      if (isDomainError(error)) return { status: 'error', messageKey: error.messageKey as MessageKey, field: error.field };
      return { status: 'error', messageKey: 'studio.availability.error' as MessageKey };
    }
  });

/* ─────────────────────────── Исключения (отпуск, блокировка, разовое окно) ─────────────────────────── */

export const saveAvailabilityException = authedAction
  .metadata({ rateLimit: 'adminMutation' })
  .inputSchema(exceptionInput)
  .action(async ({ parsedInput }): Promise<AvailabilityActionState> => {
    try {
      const { instructorId } = await requireInstructorProfile();

      const startsAt = scheduleInstant(parsedInput.date, parsedInput.startTime);
      const endsAt = scheduleInstant(parsedInput.date, parsedInput.endTime);
      if (!startsAt || !endsAt) {
        return { status: 'error', field: 'date', messageKey: 'studio.availability.error' as MessageKey };
      }

      const data = {
        instructorId,
        startsAt,
        endsAt,
        isAvailable: parsedInput.isAvailable,
        reason: parsedInput.reason || null,
      };

      if (parsedInput.id) {
        const updated = await db.availabilityException.updateMany({ where: { id: parsedInput.id, instructorId }, data });
        if (updated.count !== 1) throw domainErrors.notFound();
      } else {
        await db.availabilityException.create({ data });
      }

      updateTag(cacheTags.instructors());
      return { status: 'success', messageKey: 'studio.availability.saved' as MessageKey };
    } catch (error) {
      if (isDomainError(error)) return { status: 'error', messageKey: error.messageKey as MessageKey, field: error.field };
      return { status: 'error', messageKey: 'studio.availability.error' as MessageKey };
    }
  });

/* ─────────────────────────── Удаление ─────────────────────────── */

export const deleteAvailabilityEntry = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'availability.delete' })
  .inputSchema(deleteInput)
  .action(async ({ parsedInput }): Promise<AvailabilityActionState> => {
    try {
      const { instructorId } = await requireInstructorProfile();

      if (parsedInput.table === 'rule') {
        const removed = await db.availabilityRule.deleteMany({ where: { id: parsedInput.id, instructorId } });
        if (removed.count !== 1) throw domainErrors.notFound();
      } else {
        const removed = await db.availabilityException.deleteMany({ where: { id: parsedInput.id, instructorId } });
        if (removed.count !== 1) throw domainErrors.notFound();
      }

      updateTag(cacheTags.instructors());
      return { status: 'success', messageKey: 'studio.availability.saved' as MessageKey };
    } catch (error) {
      if (isDomainError(error)) return { status: 'error', messageKey: error.messageKey as MessageKey };
      return { status: 'error', messageKey: 'studio.availability.error' as MessageKey };
    }
  });

/* ─────────────────────────── Включение/выключение правила ─────────────────────────── */

export const toggleAvailabilityRule = authedAction
  .metadata({ rateLimit: 'adminMutation' })
  .inputSchema(toggleInput)
  .action(async ({ parsedInput }): Promise<AvailabilityActionState> => {
    try {
      const { instructorId } = await requireInstructorProfile();

      const updated = await db.availabilityRule.updateMany({
        where: { id: parsedInput.id, instructorId },
        data: { isActive: parsedInput.isActive },
      });
      if (updated.count !== 1) throw domainErrors.notFound();

      updateTag(cacheTags.instructors());
      return { status: 'success', messageKey: 'studio.availability.saved' as MessageKey };
    } catch (error) {
      if (isDomainError(error)) return { status: 'error', messageKey: error.messageKey as MessageKey };
      return { status: 'error', messageKey: 'studio.availability.error' as MessageKey };
    }
  });

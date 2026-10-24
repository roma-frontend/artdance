/**
 * API: GET и POST /api/studio/availability — расписание инструктора для мобильного приложения.
 *
 * GET отдаёт недельные правила и исключения текущего инструктора. POST выполняет одну операцию
 * (`op`): сохранить правило, сохранить исключение, удалить или переключить правило. Запись идёт
 * через те же действия, что и на вебе (`src/server/actions/availability.ts`), поэтому проверка
 * владельца, защита от пересечений и сброс кеша каталога общие для обоих клиентов.
 *
 * Личность берётся только из серверной сессии (bearer или cookie).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { scheduleExceptionSchema, scheduleRuleSchema } from '@/domain/availability/schedule';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { requireInstructorProfile } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import {
  deleteAvailabilityEntry,
  saveAvailabilityException,
  saveAvailabilityRule,
  toggleAvailabilityRule,
} from '@/server/actions/availability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().trim().min(1).max(64);

const operationSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('saveRule'), rule: scheduleRuleSchema }),
  z.object({ op: z.literal('saveException'), exception: scheduleExceptionSchema }),
  z.object({ op: z.literal('delete'), table: z.enum(['rule', 'exception']), id: idSchema }),
  z.object({ op: z.literal('toggle'), id: idSchema, isActive: z.boolean() }),
]);

type Operation = z.infer<typeof operationSchema>;

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none } });
}

function failure(error: unknown) {
  if (isDomainError(error)) {
    return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
  }
  console.error('[studio:availability]', error);
  return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
}

/** Выбор действия по `op`. Каждое действие сам проверяет владельца и права. */
function runOperation(input: Operation) {
  switch (input.op) {
    case 'saveRule':
      return saveAvailabilityRule(input.rule);
    case 'saveException':
      return saveAvailabilityException(input.exception);
    case 'delete':
      return deleteAvailabilityEntry({ table: input.table, id: input.id });
    case 'toggle':
      return toggleAvailabilityRule({ id: input.id, isActive: input.isActive });
  }
}

export async function GET() {
  try {
    const { instructorId } = await requireInstructorProfile();

    const [rules, exceptions] = await Promise.all([
      db.availabilityRule.findMany({
        where: { instructorId },
        orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
        select: { id: true, weekday: true, startTime: true, endTime: true, validFrom: true, validUntil: true, isActive: true },
      }),
      db.availabilityException.findMany({
        where: { instructorId, endsAt: { gte: new Date() } },
        orderBy: { startsAt: 'asc' },
        select: { id: true, startsAt: true, endsAt: true, isAvailable: true, reason: true },
      }),
    ]);

    return json(
      {
        rules: rules.map((row) => ({
          id: row.id,
          weekday: row.weekday,
          startTime: row.startTime,
          endTime: row.endTime,
          validFrom: row.validFrom ? row.validFrom.toISOString().slice(0, 10) : null,
          validUntil: row.validUntil ? row.validUntil.toISOString().slice(0, 10) : null,
          isActive: row.isActive,
        })),
        exceptions: exceptions.map((row) => ({
          id: row.id,
          startsAt: row.startsAt.toISOString(),
          endsAt: row.endsAt.toISOString(),
          isAvailable: row.isAvailable,
          reason: row.reason,
        })),
      },
      200,
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const parsed = operationSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

  try {
    /* Явная проверка профиля даёт честный 403 вместо «ошибки сохранения» из действия. */
    await requireInstructorProfile();

    const result = await runOperation(parsed.data);

    if (result.serverError) {
      return json(
        { error: result.serverError.code, messageKey: result.serverError.messageKey, params: result.serverError.params },
        httpStatusFor(result.serverError.code),
      );
    }
    if (result.validationErrors) {
      return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
    }

    const state = result.data;
    if (!state) return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
    if (state.status === 'error') {
      return json({ error: 'ACTION_FAILED', messageKey: state.messageKey ?? 'errors.generic.title', field: state.field }, 422);
    }
    return json({ status: 'success', messageKey: state.messageKey }, 200);
  } catch (error) {
    return failure(error);
  }
}

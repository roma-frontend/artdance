/**
 * API: POST /api/events/[slug]/register — заявка на соревнование из мобильного приложения.
 *
 * Зеркало веб-действия `submitCompetitionRegistration`: та же проверка модуля `events`,
 * та же транзакция (`registerForCompetition`). Требуется сессия (Bearer-токен).
 * Успех: 201 с идентификатором заявки. Отказы:
 * 401 (нет сессии), 404 (нет категории), 409 (регистрация закрыта, уже подано, категория заполнена),
 * 422 (возраст не подходит), 400 (неверный ввод).
 */

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';

import { cacheControl, cacheTags } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { getCaller } from '@/lib/auth/guards';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import {
  CompetitionRegistrationError,
  parseBirthDate,
  registerForCompetition,
  type CompetitionRegistrationFailure,
} from '@/server/events/register';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  categoryId: z.string().trim().min(1).max(64),
  birthDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  partnerName: z.string().trim().max(160).optional(),
});

const FAILURES: Record<CompetitionRegistrationFailure, { error: string; status: number; messageKey: string }> = {
  REGISTRATION_CLOSED: { error: 'REGISTRATION_CLOSED', status: 409, messageKey: 'events.registrationClosed' },
  CATEGORY_NOT_FOUND: { error: 'CATEGORY_NOT_FOUND', status: 404, messageKey: 'events.registrationError' },
  AGE_NOT_ELIGIBLE: { error: 'AGE_NOT_ELIGIBLE', status: 422, messageKey: 'events.ageNotEligible' },
  ALREADY_REGISTERED: { error: 'ALREADY_REGISTERED', status: 409, messageKey: 'events.alreadyRegistered' },
  CATEGORY_FULL: { error: 'CATEGORY_FULL', status: 409, messageKey: 'events.categoryFull' },
};

function json(body: object, status: number, headers?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': cacheControl.none, 'X-Content-Type-Options': 'nosniff', ...headers },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const identifier = clientIdentifier(request.headers);
  const limit = await checkRateLimit('contactForm', identifier);
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'contactForm'),
    );
  }

  const { slug } = await params;
  const eventSlug = z.string().trim().min(1).max(160).safeParse(slug);
  if (!eventSlug.success) return json({ error: 'NOT_FOUND', messageKey: 'events.registrationError' }, 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const caller = await getCaller();
  if (!caller) return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);

  const birthDate = parseBirthDate(parsed.data.birthDate);
  if (!birthDate) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required', field: 'birthDate' }, 400);

  try {
    /* Выключенный модуль событий не принимает регистрации, даже из прямого запроса. */
    await assertEntitlementOrThrow('events');
    const registration = await registerForCompetition({
      userId: caller.id,
      eventSlug: eventSlug.data,
      categoryId: parsed.data.categoryId,
      birthDate,
      partnerName: parsed.data.partnerName || null,
    });
    revalidateTag(cacheTags.events(), 'max');
    return json({ registration: { id: registration.id } }, 201);
  } catch (error) {
    if (error instanceof CompetitionRegistrationError) {
      const failure = FAILURES[error.code];
      return json({ error: failure.error, messageKey: failure.messageKey }, failure.status);
    }
    if (isDomainError(error)) {
      return json({ error: error.code, messageKey: error.messageKey, params: error.params, field: error.field }, httpStatusFor(error.code));
    }
    console.error('[events/register]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
  }
}

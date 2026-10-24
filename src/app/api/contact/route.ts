/**
 * API: POST /api/contact — обращение в поддержку из мобильного приложения.
 *
 * Зеркало `sendContactMessage`: тот же лимит, та же капча и та же запись обращения,
 * собранные в `submitContactMessage`.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { contactMessageSchema, submitContactMessage } from '@/server/contact/service';
import { assertCaptcha } from '@/server/safe-action';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status: number, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...headers } });
}

export async function POST(request: Request) {
  const identifier = clientIdentifier(request.headers);
  const limit = await checkRateLimit('contactForm', identifier);
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'contactForm'),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const parsed = contactMessageSchema.safeParse(body);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? '');
    const messageKey = field === 'email' ? 'validation.email' : 'validation.required';
    return json({ error: 'VALIDATION_FAILED', messageKey, field }, 400);
  }

  try {
    await assertCaptcha(parsed.data.captchaToken, identifier);
    const outcome = await submitContactMessage(parsed.data);
    return json(outcome, 200);
  } catch (error) {
    if (isDomainError(error)) {
      return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
    }
    console.error('[api:contact]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

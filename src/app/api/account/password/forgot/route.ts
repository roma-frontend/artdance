/**
 * API: POST /api/account/password/forgot — запрос ссылки для сброса пароля из мобильного приложения.
 *
 * Зеркало `forgotPasswordAction`: тот же лимит, та же капча и тот же ответ,
 * независимо от того, зарегистрирован адрес или нет.
 */

import { APIError } from 'better-auth/api';
import { NextResponse } from 'next/server';

import { absoluteUrl } from '@/config/site';
import { routes } from '@/config/routes';
import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { forgotPasswordSchema } from '@/domain/auth';
import { auth } from '@/lib/auth/auth';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { assertCaptcha } from '@/server/safe-action';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status: number, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...headers } });
}

export async function POST(request: Request) {
  const identifier = clientIdentifier(request.headers);
  const limit = await checkRateLimit('passwordReset', identifier);
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'passwordReset'),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

  try {
    await assertCaptcha(parsed.data.captchaToken, identifier);

    try {
      await auth.api.requestPasswordReset({
        body: {
          email: parsed.data.email,
          redirectTo: absoluteUrl(routes.resetPassword()),
        },
        headers: request.headers,
      });
    } catch (error) {
      // Отказ не раскрываем: ответ остаётся одинаковым для любого адреса.
      if (!(error instanceof APIError)) throw error;
      console.warn('[auth] requestPasswordReset', error.body?.code ?? error.message);
    }

    return json({ sent: true }, 200);
  } catch (error) {
    if (isDomainError(error)) {
      return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
    }
    console.error('[account:password:forgot]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

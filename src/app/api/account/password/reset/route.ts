/**
 * API: POST /api/account/password/reset — установка нового пароля по токену из письма (мобильное приложение).
 *
 * Зеркало `resetPasswordAction`: та же схема, тот же лимит, тот же ответ при неверном токене.
 * Ошибки валидации отдаются ключом i18n (`messageKey`), как и в остальных маршрутах для мобильного приложения.
 */

import { APIError } from 'better-auth/api';
import { NextResponse } from 'next/server';

import { security } from '@/config/business';
import { cacheControl } from '@/config/cache';
import { domainErrors, httpStatusFor, isDomainError } from '@/domain/errors';
import { resetPasswordSchema } from '@/domain/auth';
import { auth } from '@/lib/auth/auth';
import { auditPasswordReset, userIdForResetToken } from '@/lib/auth/password-reset-audit';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';

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

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const messageKey = parsed.error.issues[0]?.message ?? 'validation.required';
    return json({ error: 'VALIDATION_FAILED', messageKey, params: { min: security.password.minLength } }, 400);
  }

  try {
    const userId = await userIdForResetToken(parsed.data.token);
    try {
      await auth.api.resetPassword({
        body: { newPassword: parsed.data.password, token: parsed.data.token },
        headers: request.headers,
      });
    } catch (error) {
      if (error instanceof APIError) throw domainErrors.invalidResetToken();
      throw error;
    }

    await auditPasswordReset({
      userId,
      ipAddress: identifier,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return json({ updated: true }, 200);
  } catch (error) {
    if (isDomainError(error)) {
      return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
    }
    console.error('[account:password:reset]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

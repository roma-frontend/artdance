import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { auth, socialProviderFlags } from '@/lib/auth/auth';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { isValidChallenge } from '@/server/auth/mobile-handoff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDERS = ['google', 'apple'] as const;
type Provider = (typeof PROVIDERS)[number];

/**
 * GET /api/mobile/auth/start?provider=google&challenge=… — начало OAuth для приложения.
 *
 * Открывается в системном браузере приложения: cookie состояния OAuth ставятся здесь же,
 * провайдер возвращает на `/api/mobile/auth/handoff`, который отдаёт приложению одноразовый код.
 */
export async function GET(request: Request) {
  const limit = await checkRateLimit('signIn', clientIdentifier(request.headers));
  if (!limit.allowed) {
    return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Cache-Control': cacheControl.none, ...rateLimitHeaders(limit, 'signIn') } });
  }
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider') as Provider | null;
  const challenge = url.searchParams.get('challenge') ?? '';
  if (!provider || !PROVIDERS.includes(provider) || !socialProviderFlags[provider] || !isValidChallenge(challenge)) {
    return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400, headers: { 'Cache-Control': cacheControl.none } });
  }

  const callbackURL = `/api/mobile/auth/handoff?challenge=${encodeURIComponent(challenge)}`;
  const started = await auth.api.signInSocial({
    body: { provider, callbackURL, errorCallbackURL: `${callbackURL}&error=1`, disableRedirect: true },
    headers: request.headers,
    asResponse: true,
  });
  const body = (await started.json().catch(() => null)) as { url?: string } | null;
  if (!started.ok || !body?.url) {
    return NextResponse.json({ error: 'PROVIDER_UNAVAILABLE' }, { status: 502, headers: { 'Cache-Control': cacheControl.none } });
  }

  const response = NextResponse.redirect(body.url, 302);
  response.headers.set('Cache-Control', cacheControl.none);
  // Cookie состояния OAuth нужны на обратном пути: без них библиотека отвергнет callback.
  for (const cookie of started.headers.getSetCookie()) response.headers.append('Set-Cookie', cookie);
  return response;
}

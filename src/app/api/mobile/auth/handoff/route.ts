import { NextResponse } from 'next/server';

import { security } from '@/config/business';
import { cacheControl } from '@/config/cache';
import { auth } from '@/lib/auth/auth';
import { createHandoffCode, isValidChallenge } from '@/server/auth/mobile-handoff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Схема из `mobile/app.json`: браузер входа закрывается, как только видит этот адрес. */
const APP_CALLBACK = 'artdance://auth-callback';

function back(params: Record<string, string>) {
  const target = new URL(APP_CALLBACK);
  for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
  const response = NextResponse.redirect(target.toString(), 302);
  response.headers.set('Cache-Control', cacheControl.none);
  return response;
}

function sessionCookie(header: string | null): string | null {
  if (!header) return null;
  const name = security.session.requestCookieName;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/** GET /api/mobile/auth/handoff — возврат после OAuth: сессия браузера меняется на одноразовый код для приложения. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get('challenge') ?? '';
  if (url.searchParams.get('error') || !isValidChallenge(challenge)) return back({ error: 'cancelled' });

  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  const token = sessionCookie(request.headers.get('cookie'));
  if (!session || !token) return back({ error: 'cancelled' });

  const code = await createHandoffCode({ sessionToken: token, challenge, now: new Date() });
  return back({ code });
}

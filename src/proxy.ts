/**
 * PROXY (в Next.js ≤15 назывался middleware) — единый edge-слой безопасности.
 *
 * Пять задач за один проход, без обращений к базе данных:
 *   1. security-заголовки и CSP на каждый ответ;
 *   2. CSRF: проверка `Origin` на мутирующих методах;
 *   3. backstop rate limit на весь `/api`;
 *   4. локализация URL (next-intl);
 *   5. гейт приватных разделов по наличию cookie сессии.
 *
 * Почему всё вместе: заголовки, заданные и здесь, и в `next.config.ts`,
 * конфликтуют, а отладка превращается в угадывание, какой слой победил.
 * Разделение зафиксировано так: **безопасность — здесь, Cache-Control —
 * в `next.config.ts`**.
 *
 * Чего здесь принципиально НЕТ:
 *   • обращений к БД — proxy выполняется на каждый запрос;
 *   • реальной проверки прав — cookie можно подделать. Здесь только
 *     перенаправление на страницу входа; авторизация в `@/lib/auth/guards`;
 *   • `Set-Cookie` на каждый ответ — это сделало бы страницы некешируемыми CDN
 *     и заставило вызывать функцию на каждый просмотр каталога.
 */

import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { security } from '@/config/business';
import { isProtectedPath, routes } from '@/config/routes';
import {
  authContentSecurityPolicy,
  authCspPathPrefixes,
  baseSecurityHeaders,
  contentSecurityPolicy,
  mutatingMethods,
  originExemptPathPrefixes,
} from '@/config/security';
import { locales } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { checkApiFloodLimit, clientIdentifier } from '@/lib/security/rate-limit';

const intlMiddleware = createIntlMiddleware(routing);

const MUTATING = new Set<string>(mutatingMethods);

function applySecurityHeaders(response: NextResponse, pathname: string): NextResponse {
  for (const [key, value] of baseSecurityHeaders) {
    response.headers.set(key, value);
  }

  const needsAuthCsp = authCspPathPrefixes.some((prefix) =>
    stripLocale(pathname).startsWith(prefix),
  );
  response.headers.set(
    'Content-Security-Policy',
    needsAuthCsp ? authContentSecurityPolicy : contentSecurityPolicy,
  );
  response.headers.delete('x-powered-by');
  return response;
}

/** Убирает префикс локали: `/hy/account` → `/account`. */
function stripLocale(pathname: string): string {
  const segments = pathname.split('/');
  const maybeLocale = segments[1];
  if (maybeLocale && (locales as readonly string[]).includes(maybeLocale)) {
    const rest = segments.slice(2).join('/');
    return rest ? `/${rest}` : '/';
  }
  return pathname;
}

function localeOf(pathname: string): string {
  const candidate = pathname.split('/')[1];
  return candidate && (locales as readonly string[]).includes(candidate)
    ? candidate
    : routing.defaultLocale;
}

/**
 * CSRF через `Origin`. Браузер всегда присылает `Origin` на cross-site запросе;
 * клиент без `Origin` (server-to-server, curl) не носит cookies, поэтому не
 * может воспользоваться чужой сессией. Токены и их хранение не нужны.
 */
function rejectsCrossOrigin(request: NextRequest): boolean {
  if (!MUTATING.has(request.method)) return false;

  const pathname = request.nextUrl.pathname;
  if (originExemptPathPrefixes.some((prefix) => pathname.startsWith(prefix))) return false;

  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    return new URL(origin).host.toLowerCase() !== request.headers.get('host')?.toLowerCase();
  } catch {
    /** Нераспарсиваемый Origin — отклоняем: это точно не легитимный браузер. */
    return true;
  }
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (rejectsCrossOrigin(request)) {
    return applySecurityHeaders(
      NextResponse.json({ error: 'CROSS_ORIGIN_REJECTED' }, { status: 403 }),
      pathname,
    );
  }

  /**
   * Backstop от флуда на всё API. Точечные лимиты (логин, платежи, брони)
   * применяются в самих операциях по ключам из `rateLimits`.
   */
  if (pathname.startsWith('/api/')) {
    const flood = await checkApiFloodLimit(clientIdentifier(request.headers));
    if (!flood.allowed) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: 'RATE_LIMITED' },
          { status: 429, headers: { 'Retry-After': String(flood.retryAfterSeconds) } },
        ),
        pathname,
      );
    }
    /** API не участвует в локализации URL. */
    return applySecurityHeaders(NextResponse.next(), pathname);
  }

  const response = intlMiddleware(request);

  const pathWithoutLocale = stripLocale(pathname);

  if (isProtectedPath(pathWithoutLocale) && !request.cookies.has(security.session.cookieName)) {
    /*
     * Путь запоминается БЕЗ префикса локали. Локаль вернёт навигация next-intl
     * после входа: сохранив `/en/account`, мы получили бы `/en/en/account` —
     * страницу, которой нет, ровно в момент, когда человек только что успешно
     * вошёл. Ошибка не видна ни типам, ни сборке, потому что оба пути — строки.
     */
    const redirectTo = pathWithoutLocale + request.nextUrl.search;
    const signInUrl = new URL(
      `/${localeOf(pathname)}${routes.signIn(redirectTo)}`,
      request.url,
    );
    return applySecurityHeaders(NextResponse.redirect(signInUrl), pathname);
  }

  return applySecurityHeaders(response, pathname);
}

/**
 * Matcher включает `/api`, чтобы origin-check, rate limit и заголовки работали и
 * там. Исключены внутренние пути Next, туннель Sentry (`/monitoring` — иначе
 * клиентские ошибки не доедут) и всё с расширением: proxy не должен запускаться
 * на изображениях и шрифтах.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|monitoring|favicon\\.ico|.*\\..*).*)'],
};

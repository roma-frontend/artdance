import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import proxy from './proxy';

// ESM-сборка next-intl импортирует `next/server` без расширения, и vitest такой путь не резолвит.
// Локализация здесь не проверяется, поэтому middleware заменён на пропуск запроса, а маршрутизация next-intl — на заглушку.
vi.mock('next-intl/middleware', async () => {
  const { NextResponse } = await import('next/server');
  return { default: () => () => NextResponse.next() };
});
vi.mock('@/i18n/routing', () => ({ routing: { defaultLocale: 'hy', locales: ['hy', 'ru', 'en'] } }));
// Модули с базой и хранилищем лимитов не нужны, чтобы проверить только захват кода.
vi.mock('@/lib/auth/bearer', () => ({ isBearerRequest: () => false }));
vi.mock('@/lib/security/rate-limit', () => ({
  checkApiFloodLimit: async () => ({ allowed: true, retryAfterSeconds: 0 }),
  clientIdentifier: () => 'test-client',
}));

const NINETY_DAYS_IN_SECONDS = 90 * 24 * 60 * 60;

describe('proxy: захват ?ref=', () => {
  it('кладёт код в cookie и перенаправляет на тот же адрес без параметра', async () => {
    const response = await proxy(
      new NextRequest('http://localhost:3000/hy/classes?ref=abc12345&tab=week'),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/hy/classes?tab=week');
    expect(response.cookies.get('ref')).toMatchObject({
      value: 'ABC12345',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: NINETY_DAYS_IN_SECONDS,
    });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('не перенаправляет и не ставит cookie при неверном коде', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/hy?ref=%3Cscript%3E'));

    expect(response.headers.get('location')).toBeNull();
    expect(response.cookies.get('ref')).toBeUndefined();
  });

  it('не захватывает код на POST', async () => {
    const response = await proxy(
      new NextRequest('http://localhost:3000/hy?ref=abc12345', { method: 'POST' }),
    );

    expect(response.cookies.get('ref')).toBeUndefined();
  });
});

/**
 * Имя cookie сессии: согласованность конфигурации с тем, что делает библиотека.
 *
 * Better Auth добавляет префикс `__Secure-`, когда помечает cookie `Secure`.
 * Значит имя, которым cookie настраивается, и имя, под которым она приходит в
 * запросе, — два разных значения. Если `proxy.ts` возьмёт первое, пользователь с
 * валидной сессией будет вечно перекидываться на страницу входа, причём ни в
 * логах, ни в ответе ошибки не появится: cookie просто «нет».
 *
 * Тест закрывает обе стороны: арифметику имени и то, что `proxy.ts` спрашивает
 * именно приходящее имя. Вторая проверка статическая, по исходнику, — поведение
 * proxy иначе воспроизводится только живым HTTPS-стендом.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { security } from './business';
import { clientEnv } from './env';

const SECURE_PREFIX = '__Secure-';

describe('cookie сессии', () => {
  it('настраиваемое имя не содержит префикса — его добавляет библиотека', () => {
    expect(security.session.cookieName.startsWith(SECURE_PREFIX)).toBe(false);
  });

  it('признак secure следует из адреса приложения, а не из названия окружения', () => {
    expect(security.session.secureCookies).toBe(
      clientEnv.NEXT_PUBLIC_APP_URL.startsWith('https://'),
    );
  });

  it('приходящее имя получает префикс ровно тогда, когда cookie помечена Secure', () => {
    expect(security.session.requestCookieName).toBe(
      security.session.secureCookies
        ? `${SECURE_PREFIX}${security.session.cookieName}`
        : security.session.cookieName,
    );
  });

  it('proxy.ts проверяет приходящее имя, а не настраиваемое', () => {
    const proxy = readFileSync(fileURLToPath(new URL('../proxy.ts', import.meta.url)), 'utf8');

    expect(proxy).toContain('security.session.requestCookieName');
    expect(proxy).not.toContain('security.session.cookieName');
  });

  /*
   * Тесты идут с `NEXT_PUBLIC_APP_URL=http://localhost:3000`, то есть в
   * не-secure ветке. Сломалась ровно другая, поэтому она проверяется на свежем
   * импорте конфигурации с подменённым адресом.
   */
  it('на https-адресе имя получает префикс __Secure-', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://artdance.vercel.app');
    vi.resetModules();

    try {
      const { security: onHttps } = await import('./business');

      expect(onHttps.session.secureCookies).toBe(true);
      expect(onHttps.session.requestCookieName).toBe(
        `${SECURE_PREFIX}${onHttps.session.cookieName}`,
      );
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

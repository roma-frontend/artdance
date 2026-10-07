import { afterEach, describe, expect, it, vi } from 'vitest';

const requiredPublicKeys = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_APP_ENV',
  'NEXT_PUBLIC_DEFAULT_LOCALE',
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('окружение сборки и сайта', () => {
  it.each(requiredPublicKeys)('не подменяет отсутствующий %s дефолтом даже при сборке', async (key) => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    vi.stubEnv(key, undefined);
    vi.resetModules();
    await expect(import('./env')).rejects.toThrow(key);
  });

  it.each(['DATABASE_URL', 'AUTH_SECRET'])('требует серверный %s', async (key) => {
    vi.stubEnv(key, undefined);
    vi.resetModules();
    const { getServerEnv } = await import('./env');
    expect(() => getServerEnv()).toThrow(key);
  });

  it('не принимает короткий AUTH_SECRET', async () => {
    vi.stubEnv('AUTH_SECRET', 'too-short');
    vi.resetModules();
    const { getServerEnv } = await import('./env');
    expect(() => getServerEnv()).toThrow('AUTH_SECRET');
  });

  it('сохраняет реальные публичные настройки и принимает валидное окружение', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://dance.example');
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production');
    vi.resetModules();
    const { clientEnv, getServerEnv, isProduction } = await import('./env');
    expect(clientEnv.NEXT_PUBLIC_APP_URL).toBe('https://dance.example');
    expect(isProduction).toBe(true);
    expect(getServerEnv().DATABASE_URL).toBe(process.env.DATABASE_URL);
    expect(getServerEnv().AUTH_SECRET).toBe(process.env.AUTH_SECRET);
  });
});

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { assertSeedTarget } from './seed-guard.ts';

const LOCAL = 'postgresql://postgres:secret@localhost:5432/artdance';
const POOLER =
  'postgresql://postgres.abcdefghijkl:TOPSECRET@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';
const POOLER_TARGET =
  'postgres.abcdefghijkl@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';

describe('assertSeedTarget', () => {
  it('пускает локальные хосты', () => {
    expect(assertSeedTarget(LOCAL, {})).toBe('postgres@localhost:5432/artdance');
    expect(assertSeedTarget('postgresql://u:p@127.0.0.1:55440/x', {})).toBe('u@127.0.0.1:55440/x');
    expect(assertSeedTarget('postgresql://u:p@[::1]:5432/x', {})).toBe('u@[::1]:5432/x');
    expect(assertSeedTarget('postgresql://u:p@LOCALHOST:5432/x', {})).toBe('u@localhost:5432/x');
  });

  it('не пускает чужую базу без явного разрешения', () => {
    expect(() => assertSeedTarget(POOLER, {})).toThrow(POOLER_TARGET);
  });

  it('пускает чужую базу, если SEED_ALLOW_REMOTE_DB равен её имени', () => {
    expect(assertSeedTarget(POOLER, { SEED_ALLOW_REMOTE_DB: POOLER_TARGET })).toBe(POOLER_TARGET);
  });

  it('разрешение для другого проекта не действует', () => {
    const otherProject =
      'postgres.zzzzzzzzzzzz@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';
    expect(() => assertSeedTarget(POOLER, { SEED_ALLOW_REMOTE_DB: otherProject })).toThrow(
      'не локальная',
    );
  });

  it('production-окружение не пускает даже локальную базу', () => {
    expect(() => assertSeedTarget(LOCAL, { NODE_ENV: 'production' })).toThrow(
      'NODE_ENV=production',
    );
    expect(() => assertSeedTarget(LOCAL, { NEXT_PUBLIC_APP_ENV: 'production' })).toThrow(
      'NEXT_PUBLIC_APP_ENV=production',
    );
    expect(() => assertSeedTarget(LOCAL, { VERCEL_ENV: 'production' })).toThrow(
      'VERCEL_ENV=production',
    );
  });

  it('хост в параметре host не обходит проверку', () => {
    const hidden = 'postgresql://u:p@localhost:5432/x?host=db.remote.example';
    expect(() => assertSeedTarget(hidden, {})).toThrow('не локальная');
    expect(() => assertSeedTarget(hidden, { SEED_ALLOW_REMOTE_DB: 'u@localhost:5432/x' })).toThrow(
      'не локальная',
    );
  });

  it('пустой хост и нераспознанная строка не пускаются', () => {
    expect(() => assertSeedTarget('postgresql:///x', {})).toThrow('не локальная');
    expect(() => assertSeedTarget('не строка', {})).toThrow('не разбирается');
  });

  it('сообщение об ошибке не содержит пароль', () => {
    let message = '';
    try {
      assertSeedTarget('postgresql://u:TOPSECRET@db.remote.example:5432/x', {});
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain('db.remote.example');
    expect(message).not.toContain('TOPSECRET');
  });

  it('сид проверяет цель до создания клиента Prisma', () => {
    const seed = readFileSync(fileURLToPath(new URL('./seed.ts', import.meta.url)), 'utf8');
    const guard = seed.indexOf('assertSeedTarget(connectionString');
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(seed.indexOf('new PrismaClient('));
  });
});

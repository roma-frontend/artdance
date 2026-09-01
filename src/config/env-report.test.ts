import { describe, expect, it } from 'vitest';

import { checkEnvironment } from './env-report';

const complete: Record<string, string> = {
  NEXT_PUBLIC_APP_ENV: 'production',
  DATABASE_URL: 'postgres://x',
  DIRECT_DATABASE_URL: 'postgres://x',
  R2_ACCOUNT_ID: 'a',
  R2_ACCESS_KEY_ID: 'b',
  R2_SECRET_ACCESS_KEY: 'c',
  R2_BUCKET: 'd',
  R2_PUBLIC_BASE_URL: 'https://cdn.example',
  RESEND_API_KEY: 'k',
  EMAIL_FROM: 'a@b.c',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 's',
  TURNSTILE_SECRET_KEY: 't',
  RATE_LIMIT_REDIS_URL: 'https://redis',
  RATE_LIMIT_REDIS_TOKEN: 'tok',
  NEXT_PUBLIC_SENTRY_DSN: 'https://dsn',
  NEXT_PUBLIC_MAPS_API_KEY: 'm',
  SMS_API_KEY: 'x',
  SMS_SENDER_ID: 'ArtDance',
  GOOGLE_CLIENT_ID: 'g',
  GOOGLE_CLIENT_SECRET: 'gs',
  CRON_SECRET: 'cs',
  PAYMENT_PROVIDER: 'paynet',
  PAYNET_API_URL: 'https://paynet',
  PAYNET_MERCHANT_ID: 'm',
  PAYNET_API_KEY: 'k',
  PAYNET_WEBHOOK_SECRET: 'w',
};

describe('checkEnvironment', () => {
  it('на полной production-конфигурации не находит проблем', () => {
    expect(checkEnvironment(complete)).toEqual([]);
  });

  it('ловит частично настроенную группу как ошибку', () => {
    const partial = { ...complete };
    delete partial.R2_BUCKET;
    const issues = checkEnvironment(partial);
    const r2 = issues.find((i) => i.group === 'R2');
    expect(r2?.level).toBe('error');
    expect(r2?.message).toContain('R2_BUCKET');
  });

  it('полностью отсутствующая группа в production — ошибка, в local — предупреждение', () => {
    const withoutTurnstile = { ...complete };
    delete withoutTurnstile.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete withoutTurnstile.TURNSTILE_SECRET_KEY;

    expect(checkEnvironment(withoutTurnstile).find((i) => i.group === 'TURNSTILE')?.level).toBe('error');
    expect(
      checkEnvironment({ ...withoutTurnstile, NEXT_PUBLIC_APP_ENV: 'local' }).find(
        (i) => i.group === 'TURNSTILE',
      )?.level,
    ).toBe('warn');
  });

  it('ловит выбранный провайдер без реквизитов', () => {
    const noKeys = { ...complete };
    delete noKeys.PAYNET_API_KEY;
    const issue = checkEnvironment(noKeys).find((i) => i.group === 'PAYMENTS');
    expect(issue?.level).toBe('error');
    expect(issue?.message).toContain('PAYNET_API_KEY');
  });

  it('не даёт уехать в production с mock-провайдером', () => {
    const issues = checkEnvironment({ ...complete, PAYMENT_PROVIDER: 'mock' });
    expect(issues.some((i) => i.group === 'PAYMENTS' && i.level === 'error')).toBe(true);
  });

  it('предупреждает об отсутствии прямого подключения для миграций', () => {
    const noDirect = { ...complete };
    delete noDirect.DIRECT_DATABASE_URL;
    expect(checkEnvironment(noDirect).some((i) => i.group === 'DATABASE')).toBe(true);
  });

  it('в local-окружении mock-провайдер и пустые интеграции допустимы', () => {
    const issues = checkEnvironment({
      NEXT_PUBLIC_APP_ENV: 'local',
      DATABASE_URL: 'postgres://x',
      DIRECT_DATABASE_URL: 'postgres://x',
      PAYMENT_PROVIDER: 'mock',
    });
    expect(issues.every((i) => i.level !== 'error')).toBe(true);
  });
});

/**
 * ADMIN INTEGRATIONS — A-18: health внешних сервисов.
 *
 * Проверки — read-only: не пишут в БД, не трогают внешние провайдеры тяжелее
 * одного лёгкого запроса (R2 HEAD, Resend не бьём). Доступен только стаффу.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { getServerEnv } from '@/config/env';
import type { Locale } from '@/i18n/config';
import { db } from '@/lib/db';
import { adminAccess } from '@/server/admin/access';
import { AccessDenied } from '@/components/ui/access-denied';

interface PageProps {
  params: Promise<{ locale: string }>;
}

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

async function checkDb(t: Awaited<ReturnType<typeof getTranslations<'admin'>>>): Promise<Check> {
  try {
    await db.$queryRaw`SELECT 1`;
    return { name: t('integrations.dbName' as never) as string, ok: true, detail: t('integrations.dbOk' as never) as string };
  } catch (e: unknown) {
    return {
      name: t('integrations.dbName' as never) as string,
      ok: false,
      detail: e instanceof Error ? e.message.slice(0, 200) : String(e),
    };
  }
}

function checkR2(t: Awaited<ReturnType<typeof getTranslations<'admin'>>>): Check {
  const env = getServerEnv();
  const hasR2 = Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET);
  return {
    name: t('integrations.r2Name' as never) as string,
    ok: hasR2,
    detail: hasR2
      ? (t('integrations.r2Detail' as never) as string)
      : (t('integrations.r2Missing' as never) as string) || 'R2_* env missing — uploads use local driver',
  };
}

function checkPayments(t: Awaited<ReturnType<typeof getTranslations<'admin'>>>): Check {
  const env = getServerEnv();
  const isLive = env.PAYMENT_PROVIDER !== 'mock';
  return {
    name: t('integrations.paymentsName' as never) as string,
    ok: true,
    detail: isLive ? `Provider: ${env.PAYMENT_PROVIDER}` : (t('integrations.paymentsDetail' as never) as string),
  };
}

function checkEmail(t: Awaited<ReturnType<typeof getTranslations<'admin'>>>): Check {
  const env = getServerEnv();
  const ok = Boolean(env.RESEND_API_KEY);
  return {
    name: t('integrations.emailName' as never) as string,
    ok,
    detail: ok ? (t('integrations.emailOk' as never) as string) : (t('integrations.emailMissing' as never) as string),
  };
}

function checkTurnstile(t: Awaited<ReturnType<typeof getTranslations<'admin'>>>): Check {
  const env = getServerEnv();
  const hasTurnstile = Boolean(env.TURNSTILE_SECRET_KEY);
  return {
    name: t('integrations.turnstileName' as never) as string,
    ok: hasTurnstile,
    detail: hasTurnstile
      ? (t('integrations.turnstileDetail' as never) as string)
      : 'TURNSTILE_SECRET_KEY missing — captcha disabled',
  };
}

export default async function AdminIntegrationsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const { can } = await adminAccess();
  if (!can('settings.edit')) return <AccessDenied />;

  const tAdmin = await getTranslations({ locale: locale as Locale, namespace: 'admin' });
  const [dbHealth] = await Promise.all([checkDb(tAdmin)]);
  const checks: readonly Check[] = [
    dbHealth,
    checkR2(tAdmin),
    checkPayments(tAdmin),
    checkEmail(tAdmin),
    checkTurnstile(tAdmin),
  ];

  return (
    <>
      <AdminPageHeader titleKey="admin.integrations.title" subtitleKey="admin.integrations.subtitle" />
      <div className="grid gap-3">
        {checks.map((c) => (
          <div
            key={c.name}
            className={`flex items-center justify-between rounded-md border px-4 py-3 ${c.ok ? 'border-border-default bg-surface-card' : 'border-danger/30 bg-danger-soft'}`}
          >
            <div>
              <p className="text-body-sm font-semibold">{c.name}</p>
              <p className="text-caption text-content-tertiary">{c.detail}</p>
            </div>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold ${c.ok ? 'bg-success-soft text-content-success' : 'bg-danger-soft text-content-danger'}`}
            >
              {c.ok ? 'OK' : 'FAIL'}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

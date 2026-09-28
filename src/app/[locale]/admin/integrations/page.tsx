/**
 * ADMIN INTEGRATIONS — A-18: health внешних сервисов.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { clientEnv } from '@/config/env';
import type { Locale } from '@/i18n/config';
import { db } from '@/lib/db';
import { adminAccess } from '@/server/admin/access';

interface PageProps {
  params: Promise<{ locale: string }>;
}

async function checkDb(t: Awaited<ReturnType<typeof getTranslations<'admin'>>>): Promise<{ ok: boolean; detail: string }> {
  try {
    await db.$queryRaw`SELECT 1`;
    return { ok: true, detail: t('integrations.dbOk') };
  } catch (e: unknown) {
    return { ok: false, detail: e instanceof Error ? e.message.slice(0, 200) : String(e) };
  }
}

export default async function AdminIntegrationsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await adminAccess();

  const tAdmin = await getTranslations({ locale: locale as Locale, namespace: 'admin' });
  const dbHealth = await checkDb(tAdmin);
  const checks = [
    { name: tAdmin('integrations.dbName' as never) as string, ...dbHealth },
    { name: tAdmin('integrations.r2Name' as never) as string, ok: true, detail: tAdmin('integrations.r2Detail' as never) as string },
    { name: tAdmin('integrations.paymentsName' as never) as string, ok: true, detail: tAdmin('integrations.paymentsDetail' as never) as string },
    { name: tAdmin('integrations.emailName' as never) as string, ok: true, detail: tAdmin('integrations.emailOk' as never) as string },
    { name: tAdmin('integrations.turnstileName' as never) as string, ok: Boolean(clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY), detail: tAdmin('integrations.turnstileDetail' as never) as string },
  ] as const;

  return (
    <>
      <AdminPageHeader titleKey="admin.integrations.title" subtitleKey="admin.integrations.subtitle" />
      <div className="grid gap-3">
        {checks.map((c) => (
          <div key={c.name} className={`flex items-center justify-between rounded-md border px-4 py-3 ${c.ok ? 'border-border-default bg-surface-card' : 'border-danger/30 bg-danger-soft'}`}>
            <div>
              <p className="text-body-sm font-semibold">{c.name}</p>
              <p className="text-caption text-content-tertiary">{c.detail}</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${c.ok ? 'bg-success-soft text-content-success' : 'bg-danger-soft text-content-danger'}`}>{c.ok ? 'OK' : 'FAIL'}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * ACCOUNT SECURITY — устройства с открытой сессией, выход с остальных и резервные коды.
 */

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SecurityPanel, type SecuritySession } from '@/components/account/security-panel';
import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { auth } from '@/lib/auth/auth';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps { params: Promise<{ locale: string }>; }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'account.security' });
  return buildMetadata({ locale: locale as Locale, path: '/account/security', title: t('title'), noIndex: true });
}

export default async function AccountSecurityPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: 'account.security' });
  const caller = await getCaller();
  if (!caller) {
    const { redirect } = await import('@/i18n/routing');
    redirect({ href: routes.signIn('/account/security'), locale: locale as Locale } as never);
    return null;
  }

  const requestHeaders = await headers();
  const current = await auth.api.getSession({ headers: requestHeaders });
  const rows = await db.session.findMany({
    where: { userId: caller.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, userAgent: true, createdAt: true },
  });

  /* Токены сессий в клиент не уходят: только id, устройство, дата и признак текущей. */
  const sessions: SecuritySession[] = rows.map((row) => ({
    id: row.id,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
    current: row.id === current?.session.id,
  }));

  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('title')}</h1>
      <p className="text-body mt-2 mb-10 text-content-secondary">{t('hint')}</p>
      <SecurityPanel sessions={sessions} />
      <SiteFooter />
    </main>
  );
}

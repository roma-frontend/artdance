/**
 * ACCOUNT WALLET — A-11/B-04: баланс (возвраты/бонусы/подарочные карты).
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { getCaller } from '@/lib/auth/guards';
import { Price } from '@/components/ui/price';
import { db } from '@/lib/db';

interface PageProps { params: Promise<{ locale: string }>; }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: '/account/wallet', title: t('walletTitle'), noIndex: true });
}

export default async function AccountWalletPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  const caller = await getCaller();
  if (!caller) {
    const { redirect } = await import('@/i18n/routing');
    redirect({ href: routes.signIn('/account/wallet'), locale: locale as Locale } as never);
    return null;
  }
  const account = (await db.walletAccount.findUnique({ where: { userId: caller.id }, include: { entries: { orderBy: { createdAt: 'desc' }, take: 20 } } })) as unknown as { balance: number; entries: { id: string; amount: number; kind: string; createdAt: Date }[] } | null;
  const balance = account?.balance ?? 0;
  const entries = account?.entries ?? [];
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('walletTitle')}</h1>
      <p className="text-body mt-2 text-content-secondary">{t('walletHint')}</p>
      <div className="mt-6 rounded-xl border border-border-default bg-surface-card p-6">
        <p className="text-eyebrow text-content-tertiary">Balance</p>
        <div className="mt-1"><Price amount={balance} unit="perSession" emphasis="total" /></div>
      </div>
      {entries.length > 0 && (
        <ul className="mt-6 space-y-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between rounded-lg border border-border-default px-4 py-3 text-body-sm">
              <span className="text-content-secondary">{entry.kind}</span>
              <span className={entry.amount >= 0 ? 'text-content-success' : 'text-content-danger'}>{entry.amount > 0 ? '+' : ''}{entry.amount}</span>
            </li>
          ))}
        </ul>
      )}
      <SiteFooter />
    </main>
  );
}

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteFooter } from '@/components/layout/site-footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Price } from '@/components/ui/price';
import { StatusBadge } from '@/components/data/status-badge';
import { routes, site } from '@/config';
import { orderStatuses, type OrderStatus } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link, redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps { params: Promise<{ locale: string }>; }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  return buildMetadata({ locale: locale as Locale, path: routes.accountOrders(), title: t('orders.title'), noIndex: true });
}

export default async function AccountOrdersPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.accountOrders()), locale: locale as Locale });
    return null;
  }
  const orders = await db.order.findMany({
    where: { userId: caller.id },
    orderBy: { placedAt: 'desc' },
    take: 50,
    select: { id: true, orderNumber: true, status: true, total: true, currencyCode: true, placedAt: true, items: { select: { titleSnapshot: true, quantity: true } }, _count: { select: { items: true } } },
  });
  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  const tCommon = await getTranslations({ locale: locale as Locale, namespace: 'common' });
  const tNav = await getTranslations({ locale: locale as Locale, namespace: 'nav' });

  if (orders.length === 0) {
    return (
      <>
        <main id={site.mainContentId} className="page-container inner-page">
          <p className="text-eyebrow uppercase text-content-tertiary">{tNav('account')}</p>
          <h1 className="text-heading-2 mt-2">{t('orders.title')}</h1>
          <div className="mt-10"><EmptyState title={t('orders.empty')} action={<Button asChild variant="accent"><Link href={routes.shop()}>{tNav('shop')}</Link></Button>} /></div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        <p className="text-eyebrow uppercase text-content-tertiary">{tNav('account')}</p>
        <h1 className="text-heading-2 mt-2">{t('orders.title')}</h1>
        <ul className="mt-8 grid gap-4">
          {orders.map((o) => (
            <li key={o.id} className="rounded-xl border border-border-default bg-surface-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2"><span className="font-mono text-body-sm font-semibold">{o.orderNumber}</span>{(orderStatuses as readonly string[]).includes(o.status) ? <StatusBadge kind="order" status={o.status as OrderStatus} size="sm" /> : <Badge variant="neutral" size="sm">{o.status}</Badge>}</div>
                  <p className="text-body-sm mt-1 text-content-secondary">{t('orders.placedOn', { date: new Date(o.placedAt).toLocaleDateString(locale) } as never)} · {o._count.items} {tCommon('labels.quantity').toLowerCase()}</p>
                  <p className="text-body-sm mt-1 line-clamp-1 text-content-tertiary">{o.items.map((i) => i.titleSnapshot).join(', ')}</p>
                </div>
                <Price amount={o.total} emphasis="total" />
              </div>
              <div className="mt-4 flex gap-2">
                <Button asChild variant="outline" size="sm"><Link href={routes.accountOrder(o.orderNumber)}>{tCommon('actions.viewDetails')}</Link></Button>
                <Button asChild variant="ghost" size="sm"><Link href={routes.orderInvoice(o.orderNumber)}>{t('orders.invoiceCta')}</Link></Button>
              </div>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}

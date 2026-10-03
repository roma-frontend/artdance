import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { StatusBadge } from '@/components/data/status-badge';
import { routes, site } from '@/config';
import { orderStatuses, type OrderStatus } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link, redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps { params: Promise<{ locale: string; orderNumber: string }>; }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, orderNumber } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  return buildMetadata({ locale: locale as Locale, path: routes.accountOrder(orderNumber), title: `${t('orders.title')} ${orderNumber}`, noIndex: true });
}

export default async function AccountOrderPage({ params }: PageProps) {
  const { locale, orderNumber } = await params;
  setRequestLocale(locale as Locale);
  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.accountOrder(orderNumber)), locale: locale as Locale });
    return null;
  }
  const order = await db.order.findUnique({
    where: { orderNumber },
    select: {
      id: true, orderNumber: true, status: true, total: true, subtotal: true, discountTotal: true, deliveryFee: true, vatAmount: true,
      placedAt: true, paidAt: true, shippedAt: true, deliveredAt: true, cancelledAt: true, userId: true,
      items: { select: { id: true, titleSnapshot: true, quantity: true, unitPrice: true, lineTotal: true } },
      payments: { select: { id: true, status: true, amount: true, method: true, provider: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!order) notFound();
  const isOwner = order.userId === caller.id;
  const isStaff = caller.role === 'ADMIN' || caller.role === 'SUPPORT';
  if (!isOwner && !isStaff) notFound();

  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  const tCommon = await getTranslations({ locale: locale as Locale, namespace: 'common' });
  const tCheckout = await getTranslations({ locale: locale as Locale, namespace: 'checkout' });

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        <div className="flex flex-wrap items-center gap-2 text-body-sm">
          <Link href={routes.accountOrders()} className="text-content-tertiary hover:text-content-primary">{t('orders.title')}</Link>
          <span className="text-content-tertiary">/</span>
          <span className="font-mono font-semibold">{order.orderNumber}</span>
          {(orderStatuses as readonly string[]).includes(order.status) ? <StatusBadge kind="order" status={order.status as OrderStatus} size="sm" /> : <Badge variant="neutral" size="sm">{order.status}</Badge>}
        </div>

        <h1 className="text-heading-2 mt-3">{t('orders.orderNumber', { number: order.orderNumber })}</h1>
        <p className="text-body-sm mt-1 text-content-secondary">{t('orders.placedOn', { date: new Date(order.placedAt).toLocaleDateString(locale) } as never)} · {order.status}</p>

        <div className="mt-6 rounded-xl border border-border-default bg-surface-card p-6">
          <h2 className="text-card-title">{tCommon('labels.quantity')} · {order.items.length}</h2>
          <ul className="mt-4 divide-y divide-border-default">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-4 py-3 text-body-sm">
                <span>{it.titleSnapshot} × {it.quantity}</span>
                <Price amount={it.lineTotal} />
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid gap-1 border-t border-border-default pt-4 text-body-sm">
            <div className="flex justify-between"><dt className="text-content-tertiary">{tCommon('labels.subtotal')}</dt><dd><Price amount={order.subtotal} /></dd></div>
            {order.discountTotal > 0 && <div className="flex justify-between"><dt className="text-content-tertiary">{tCommon('labels.discount')}</dt><dd className="text-content-success">−<Price amount={order.discountTotal} /></dd></div>}
            {order.deliveryFee > 0 && <div className="flex justify-between"><dt className="text-content-tertiary">{tCommon('labels.delivery')}</dt><dd><Price amount={order.deliveryFee} /></dd></div>}
            <div className="flex justify-between font-semibold"><dt>{tCommon('labels.total')}</dt><dd><Price amount={order.total} emphasis="total" /></dd></div>
          </dl>

          {order.payments.length > 0 && (
            <div className="mt-6">
              <h3 className="text-body-sm font-semibold">{tCheckout('payment.title')}</h3>
              <ul className="mt-2 space-y-1 text-body-sm">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex justify-between"><span>{p.provider} · {p.method} · {p.status}</span><Price amount={p.amount} /></li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="outline"><Link href={routes.orderInvoice(order.orderNumber)}>{t('orders.invoiceCta')}</Link></Button>
            <Button asChild variant="ghost"><Link href={routes.checkoutResult(order.orderNumber)}>{tCheckout('result.viewOrderCta')}</Link></Button>
            <Button asChild variant="ghost"><Link href={routes.shop()}>{tCommon('actions.continue')}</Link></Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { StatusBadge } from '@/components/data/status-badge';
import { routes, site } from '@/config';
import { bookingStatuses, orderStatuses, type BookingStatus, type OrderStatus } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { db } from '@/lib/db';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps { params: Promise<{ locale: string; orderNumber: string }>; }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, orderNumber } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'checkout' });
  return buildMetadata({ locale: locale as Locale, path: routes.checkoutResult(orderNumber), title: t('result.successTitle'), noIndex: true });
}

export default async function CheckoutResultPage({ params }: PageProps) {
  const { locale, orderNumber } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: 'checkout' });
  const tCommon = await getTranslations({ locale: locale as Locale, namespace: 'common' });

  const order = await db.order.findUnique({
    where: { orderNumber },
    select: {
      id: true, orderNumber: true, status: true, total: true, placedAt: true,
      items: { select: { titleSnapshot: true, quantity: true, lineTotal: true } },
      payments: { select: { status: true, provider: true, method: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  // Также может быть booking reference — покажем бронь как "заказ"
  const booking = !order
    ? await db.booking.findUnique({
        where: { reference: orderNumber },
        select: { id: true, reference: true, status: true, totalPrice: true, startsAt: true, endsAt: true },
      }) ?? await db.booking.findUnique({
        where: { id: orderNumber },
        select: { id: true, reference: true, status: true, totalPrice: true, startsAt: true, endsAt: true },
      })
    : null;

  if (!order && !booking) notFound();

  if (booking) {
    const ok = booking.status === 'CONFIRMED' || booking.status === 'COMPLETED';
    const bookingKnown = (bookingStatuses as readonly string[]).includes(booking.status);
    return (
      <>
        <main id={site.mainContentId} className="page-container inner-page">
          {bookingKnown ? <StatusBadge kind="booking" status={booking.status as BookingStatus} /> : <Badge variant={ok ? 'success' : 'warning'}>{booking.status}</Badge>}
          <h1 className="text-heading-2 mt-3">{ok ? t('result.successTitle') : t('result.pendingTitle')}</h1>
          <p className="text-body mt-2 text-content-secondary">{ok ? t('result.successSubtitle', { orderNumber: booking.reference } as never) : t('result.pendingSubtitle')}</p>
          <div className="mt-6 rounded-xl border border-border-default bg-surface-card p-6">
            <p className="font-mono font-semibold">{booking.reference}</p>
            <Price amount={booking.totalPrice} emphasis="total" className="mt-2" />
            <p className="text-body-sm mt-2 text-content-tertiary">{new Date(booking.startsAt).toLocaleString(locale)} — {new Date(booking.endsAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="accent"><Link href={routes.bookingConfirm(booking.reference)}>{t('result.viewOrderCta')}</Link></Button>
              <Button asChild variant="outline"><Link href={routes.bookingPass(booking.id)}>{tCommon('labels.time' as never) as string}</Link></Button>
              <Button asChild variant="ghost"><Link href={routes.accountBookings()}>{tCommon('actions.continue')}</Link></Button>
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  // order branch — order is non-null here
  const o = order!;
  const paid = o.status === 'PAID' || o.payments[0]?.status === 'PAID';
  const failed = o.payments[0]?.status === 'FAILED';
  const orderKnown = (orderStatuses as readonly string[]).includes(o.status);
  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        {orderKnown ? <StatusBadge kind="order" status={o.status as OrderStatus} /> : <Badge variant={paid ? 'success' : failed ? 'warning' : 'neutral'}>{o.status}</Badge>}{o.payments[0] ? <span className="ml-2 text-body-sm text-content-tertiary">· {o.payments[0].status}</span> : null}
        <h1 className="text-heading-2 mt-3">{paid ? t('result.successTitle') : failed ? t('result.failedTitle') : t('result.pendingTitle')}</h1>
        <p className="text-body mt-2 text-content-secondary">{paid ? t('result.successSubtitle', { orderNumber: o.orderNumber } as never) : failed ? t('result.failedSubtitle') : t('result.pendingSubtitle')}</p>
        <div className="mt-6 rounded-xl border border-border-default bg-surface-card p-6">
          <p className="font-mono font-semibold">{o.orderNumber}</p>
          <Price amount={o.total} emphasis="total" className="mt-2" />
          <ul className="mt-4 space-y-1 text-body-sm text-content-secondary">{o.items.map((it, i) => <li key={i}>{it.titleSnapshot} × {it.quantity}</li>)}</ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="accent"><Link href={routes.accountOrder(o.orderNumber)}>{t('result.viewOrderCta')}</Link></Button>
            {failed && <Button asChild variant="outline"><Link href={routes.checkoutStep('payment')}>{t('result.retryCta')}</Link></Button>}
            <Button asChild variant="ghost"><Link href={routes.shop()}>{tCommon('actions.continue')}</Link></Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

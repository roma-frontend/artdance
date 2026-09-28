/**
 * ORDER INVOICE — A-13: печатный счёт.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';

interface PageProps { params: Promise<{ locale: string; orderNumber: string }>; }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, orderNumber } = await params;
  const tF = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: routes.orderInvoice(orderNumber), title: tF('orderInvoiceTitle', { number: orderNumber }), noIndex: true });
}

export default async function OrderInvoicePage({ params }: PageProps) {
  const { locale, orderNumber } = await params;
  setRequestLocale(locale as Locale);
  const tF = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  const caller = await getCaller();
  if (!caller) {
    const { redirect } = await import('@/i18n/routing');
    redirect({ href: routes.signIn(routes.orderInvoice(orderNumber)), locale: locale as Locale } as never);
    return null;
  }
  const order = await db.order.findUnique({ where: { orderNumber }, select: { userId: true, total: true } });
  if (!order) notFound();
  if (order.userId !== caller.id && caller.role !== 'ADMIN') notFound();
  return (
    <main id={site.mainContentId} className="page-container inner-page print:page-container">
      <h1 className="text-heading-2 print:text-heading-3">{tF('orderInvoiceTitle', { number: orderNumber })}</h1>
      <p className="text-body mt-2">{order.total} AMD</p>
      <p className="text-body-sm mt-4 text-content-tertiary print:hidden">{tF('common.printHint' as never) ?? 'Print: Ctrl+P'}</p>
      <SiteFooter />
    </main>
  );
}

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
import { ViewToggle } from '@/components/account/view-toggle';
import { resolveAccountView } from '@/components/account/view-toggle.helpers';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink } from '@/components/ui/pagination';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  return buildMetadata({ locale: locale as Locale, path: routes.accountOrders(), title: t('orders.title'), noIndex: true });
}

interface PageProps { params: Promise<{ locale: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>>; }

export default async function AccountOrdersPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  setRequestLocale(locale as Locale);
  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.accountOrders()), locale: locale as Locale });
    return null;
  }

  const view = resolveAccountView(sp);
  const pageParam = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const currentPage = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const pageSize = view === 'grid' ? 12 : 50;
  const skip = (currentPage - 1) * pageSize;

  const [total, orders] = await Promise.all([
    db.order.count({ where: { userId: caller.id } }),
    db.order.findMany({
      where: { userId: caller.id },
      orderBy: { placedAt: 'desc' },
      take: pageSize,
      skip,
      select: { id: true, orderNumber: true, status: true, total: true, currencyCode: true, placedAt: true, items: { select: { titleSnapshot: true, quantity: true } }, _count: { select: { items: true } } },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(currentPage, pageCount);

  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  const tCommon = await getTranslations({ locale: locale as Locale, namespace: 'common' });
  const tNav = await getTranslations({ locale: locale as Locale, namespace: 'nav' });

  if (total === 0) {
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

  if (currentPage > pageCount) {
    redirect({ href: `${routes.accountOrders()}?page=${pageCount}${view === 'grid' ? '&view=grid' : ''}`, locale: locale as Locale });
  }

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-eyebrow uppercase text-content-tertiary">{tNav('account')}</p>
            <h1 className="text-heading-2 mt-2">{t('orders.title')}</h1>
            <p className="text-body-sm mt-1 text-content-tertiary">{total} · {tCommon('labels.quantity').toLowerCase()}</p>
          </div>
          <ViewToggle value={view} />
        </div>
        {view === 'grid' ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-col rounded-xl border border-border-default bg-surface-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-body-sm font-semibold">{o.orderNumber}</span>{(orderStatuses as readonly string[]).includes(o.status) ? <StatusBadge kind="order" status={o.status as OrderStatus} size="sm" /> : <Badge variant="neutral" size="sm">{o.status}</Badge>}</div>
                    <p className="text-body-sm mt-1 truncate text-content-secondary">{t('orders.placedOn', { date: new Date(o.placedAt).toLocaleDateString(locale) } as never)} · {o._count.items} {tCommon('labels.quantity').toLowerCase()}</p>
                    <p className="text-body-sm mt-1 line-clamp-1 text-content-tertiary">{o.items.map((i) => i.titleSnapshot).join(', ')}</p>
                  </div>
                  <Price amount={o.total} emphasis="total" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm"><Link href={routes.accountOrder(o.orderNumber)}>{tCommon('actions.viewDetails')}</Link></Button>
                  <Button asChild variant="ghost" size="sm"><Link href={routes.orderInvoice(o.orderNumber)}>{t('orders.invoiceCta')}</Link></Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-8 divide-y divide-border-default overflow-hidden rounded-xl border border-border-default bg-surface-card">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-surface-sunken sm:gap-3 sm:px-4">
                <span className="shrink-0 font-mono text-caption font-semibold sm:text-body-sm">{o.orderNumber}</span>
                {(orderStatuses as readonly string[]).includes(o.status) ? <StatusBadge kind="order" status={o.status as OrderStatus} size="sm" /> : <Badge variant="neutral" size="sm">{o.status}</Badge>}
                <span className="hidden min-w-0 truncate text-body-sm text-content-tertiary sm:block">{o.items[0]?.titleSnapshot ?? '—'}</span>
                <span className="hidden shrink-0 text-caption text-content-tertiary sm:block">{o._count.items}×</span>
                <span className="ml-auto hidden shrink-0 text-caption text-content-tertiary sm:block">{new Date(o.placedAt).toLocaleDateString(locale)}</span>
                <Price amount={o.total} emphasis="total" />
                <Button asChild variant="ghost" size="sm" className="hidden h-7 shrink-0 px-2 sm:inline-flex"><Link href={routes.accountOrder(o.orderNumber)}>{tCommon('actions.viewDetails')}</Link></Button>
                <Button asChild variant="outline" size="sm" className="h-7 shrink-0 px-2"><Link href={routes.orderInvoice(o.orderNumber)}>{t('orders.invoiceCta')}</Link></Button>
              </li>
            ))}
          </ul>
        )}
        {pageCount > 1 ? (
          <Pagination label="Pagination" className="mt-8 flex justify-center">
            <PaginationContent>
                {safePage > 1 ? (
                  <PaginationItem><PaginationLink asChild><Link href={`${routes.accountOrders()}?page=${safePage - 1}${view === 'grid' ? '&view=grid' : ''}`}><ChevronLeft className="size-4" aria-hidden /></Link></PaginationLink></PaginationItem>
                ) : null}
                {Array.from({ length: pageCount }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === pageCount || Math.abs(p - safePage) <= 2)
                  .reduce<(number | null)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push(null);
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === null ? (
                      <PaginationItem key={`gap-${idx}`}><PaginationEllipsis label="…" /></PaginationItem>
                    ) : (
                      <PaginationItem key={p}><PaginationLink asChild isActive={p === safePage}><Link href={`${routes.accountOrders()}${p === 1 && view === 'list' ? '' : `?page=${p}${view === 'grid' ? '&view=grid' : ''}`.replace(/^\?page=1$/, '?')}`}>{p}</Link></PaginationLink></PaginationItem>
                    ),
                  )}
                {safePage < pageCount ? (
                  <PaginationItem><PaginationLink asChild><Link href={`${routes.accountOrders()}?page=${safePage + 1}${view === 'grid' ? '&view=grid' : ''}`}><ChevronRight className="size-4" aria-hidden /></Link></PaginationLink></PaginationItem>
                ) : null}
              </PaginationContent>
            </Pagination>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteFooter } from '@/components/layout/site-footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Price } from '@/components/ui/price';
import { StatusBadge } from '@/components/data/status-badge';
import { routes, site } from '@/config';
import { bookingStatuses, type BookingStatus } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link, redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { buildMetadata } from '@/lib/seo/metadata';
import { ViewToggle } from '@/components/account/view-toggle';
import { resolveAccountView } from '@/components/account/view-toggle.helpers';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationEllipsis } from '@/components/ui/pagination';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  return buildMetadata({ locale: locale as Locale, path: routes.accountBookings(), title: t('bookings.title'), noIndex: true });
}

function isBookingStatus(v: string): v is BookingStatus {
  return (bookingStatuses as readonly string[]).includes(v);
}

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccountBookingsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  setRequestLocale(locale as Locale);
  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.accountBookings()), locale: locale as Locale });
    return null;
  }

  const view = resolveAccountView(sp);
  const pageParam = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const currentPage = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const pageSize = view === 'grid' ? 12 : 50;
  const skip = (currentPage - 1) * pageSize;

  const [total, bookings] = await Promise.all([
    db.booking.count({ where: { customerId: caller.id } }),
    db.booking.findMany({
      where: { customerId: caller.id },
      orderBy: { startsAt: 'desc' },
      take: pageSize,
      skip,
      select: {
        id: true, reference: true, status: true, startsAt: true, endsAt: true, totalPrice: true, createdAt: true,
        instructor: { select: { slug: true, user: { select: { name: true } } } },
        session: { select: { danceClass: { select: { title: true, slug: true } } } },
      },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(currentPage, pageCount);

  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  const tBooking = await getTranslations({ locale: locale as Locale, namespace: 'booking' });
  const tCommon = await getTranslations({ locale: locale as Locale, namespace: 'common' });
  const tNav = await getTranslations({ locale: locale as Locale, namespace: 'nav' });

  if (total === 0) {
    return (
      <>
        <main id={site.mainContentId} className="page-container inner-page">
          <p className="text-eyebrow uppercase text-content-tertiary">{tNav('account')}</p>
          <h1 className="text-heading-2 mt-2">{t('bookings.title')}</h1>
          <div className="mt-10">
            <EmptyState
              title={t('bookings.empty')}
              action={<Button asChild variant="accent"><Link href={routes.classes()}>{t('bookings.emptyCta')}</Link></Button>}
            />
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  // Если запрошена страница за пределами — редирект на последнюю валидную
  if (currentPage > pageCount) {
    redirect({ href: `${routes.accountBookings()}?page=${pageCount}${view === 'grid' ? '&view=grid' : ''}`, locale: locale as Locale });
  }

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-eyebrow uppercase text-content-tertiary">{tNav('account')}</p>
            <h1 className="text-heading-2 mt-2">{t('bookings.title')}</h1>
            <p className="text-body mt-2 text-content-secondary">{tBooking('cancellationNote', { hours: String(24) } as never)} · {total}</p>
          </div>
          <ViewToggle value={view} />
        </div>

        {view === 'grid' ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bookings.map((b) => {
              const classTitle = (b as { session?: { danceClass?: { title?: string } } | null }).session?.danceClass?.title;
              const instructorName = (b as { instructor?: { user?: { name?: string } } | null }).instructor?.user?.name;
              const when = new Date(b.startsAt).toLocaleString(locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
              return (
                <li key={b.id} className="flex flex-col rounded-xl border border-border-default bg-surface-card p-5 shadow-sm transition hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-body-sm font-semibold">{b.reference}</span>
                        {isBookingStatus(b.status) ? <StatusBadge kind="booking" status={b.status} size="sm" /> : <Badge variant="neutral" size="sm">{b.status}</Badge>}
                      </div>
                      {(classTitle || instructorName) && <p className="text-body-sm mt-1 truncate text-content-secondary">{[classTitle, instructorName].filter(Boolean).join(' · ')}</p>}
                      <p className="text-body-sm mt-1 font-medium">{when}</p>
                    </div>
                    <Price amount={b.totalPrice} emphasis="total" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm"><Link href={routes.accountBooking(b.id)}>{tCommon('actions.viewDetails')}</Link></Button>
                    <Button asChild variant="ghost" size="sm"><Link href={routes.bookingPass(b.id)}>{tCommon('actions.viewDetails')}</Link></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="mt-8 divide-y divide-border-default overflow-hidden rounded-xl border border-border-default bg-surface-card">
            {bookings.map((b) => {
              const classTitle = (b as { session?: { danceClass?: { title?: string } } | null }).session?.danceClass?.title;
              const whenShort = new Date(b.startsAt).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
              return (
                <li key={b.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-sunken sm:px-4">
                  <span className="font-mono text-caption font-semibold sm:text-body-sm">{b.reference}</span>
                  {isBookingStatus(b.status) ? <StatusBadge kind="booking" status={b.status} size="sm" /> : <Badge variant="neutral" size="sm">{b.status}</Badge>}
                  {classTitle ? <span className="hidden min-w-0 truncate text-body-sm text-content-secondary sm:block">{classTitle}</span> : null}
                  <span className="ml-auto hidden shrink-0 text-body-sm font-medium tabular-nums sm:block">{whenShort}</span>
                  <Price amount={b.totalPrice} emphasis="total" />
                  <Button asChild variant="ghost" size="sm" className="hidden h-7 shrink-0 px-2 sm:inline-flex">
                    <Link href={routes.accountBooking(b.id)}>{tCommon('actions.viewDetails')}</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="h-7 shrink-0 px-2">
                    <Link href={routes.bookingPass(b.id)} aria-label={b.reference}>Pass</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {pageCount > 1 ? (
          <Pagination label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <PaginationContent>
                {safePage > 1 ? (
                  <PaginationItem>
                    <PaginationLink asChild>
                      <Link href={`${routes.accountBookings()}?page=${safePage - 1}${view === 'grid' ? '&view=grid' : ''}`} aria-label="Previous">
                        <ChevronLeft className="size-4" aria-hidden />
                      </Link>
                    </PaginationLink>
                  </PaginationItem>
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
                      <PaginationItem key={p}>
                        <PaginationLink asChild isActive={p === safePage}>
                          <Link href={`${routes.accountBookings()}${p === 1 && view === 'list' ? '' : `?page=${p}${view === 'grid' ? '&view=grid' : ''}`.replace(/^\?page=1$/, '?')}`}>{p}</Link>
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                {safePage < pageCount ? (
                  <PaginationItem>
                    <PaginationLink asChild>
                      <Link href={`${routes.accountBookings()}?page=${safePage + 1}${view === 'grid' ? '&view=grid' : ''}`} aria-label="Next">
                        <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    </PaginationLink>
                  </PaginationItem>
                ) : null}
              </PaginationContent>
            </Pagination>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}

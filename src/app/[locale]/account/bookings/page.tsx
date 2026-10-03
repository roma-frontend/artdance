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

interface PageProps { params: Promise<{ locale: string }>; }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  return buildMetadata({ locale: locale as Locale, path: routes.accountBookings(), title: t('bookings.title'), noIndex: true });
}

function isBookingStatus(v: string): v is BookingStatus {
  return (bookingStatuses as readonly string[]).includes(v);
}

export default async function AccountBookingsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.accountBookings()), locale: locale as Locale });
    return null;
  }
  const bookings = await db.booking.findMany({
    where: { customerId: caller.id },
    orderBy: { startsAt: 'desc' },
    take: 50,
    select: {
      id: true, reference: true, status: true, startsAt: true, endsAt: true, totalPrice: true, createdAt: true,
      instructor: { select: { slug: true, user: { select: { name: true } } } },
      session: { select: { danceClass: { select: { title: true, slug: true } } } },
    },
  });
  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  const tBooking = await getTranslations({ locale: locale as Locale, namespace: 'booking' });
  const tCommon = await getTranslations({ locale: locale as Locale, namespace: 'common' });
  const tNav = await getTranslations({ locale: locale as Locale, namespace: 'nav' });

  if (bookings.length === 0) {
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

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        <p className="text-eyebrow uppercase text-content-tertiary">{tNav('account')}</p>
        <h1 className="text-heading-2 mt-2">{t('bookings.title')}</h1>
        <p className="text-body mt-2 text-content-secondary">{tBooking('cancellationNote', { hours: String(24) } as never)}</p>

        <ul className="mt-8 grid gap-4">
          {bookings.map((b) => {
            const classTitle = (b as { session?: { danceClass?: { title?: string } } | null }).session?.danceClass?.title;
            const instructorName = (b as { instructor?: { user?: { name?: string } } | null }).instructor?.user?.name;
            const when = new Date(b.startsAt).toLocaleString(locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
            return (
              <li key={b.id} className="rounded-xl border border-border-default bg-surface-card p-5 shadow-sm transition hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-body-sm font-semibold">{b.reference}</span>
                                  {isBookingStatus(b.status) ? <StatusBadge kind="booking" status={b.status} size="sm" /> : <Badge variant="neutral" size="sm">{b.status}</Badge>}
                    </div>
                    {(classTitle || instructorName) && <p className="text-body-sm mt-1 text-content-secondary">{[classTitle, instructorName].filter(Boolean).join(' · ')}</p>}
                    <p className="text-body-sm mt-1 font-medium">{when}</p>
                  </div>
                  <Price amount={b.totalPrice} emphasis="total" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm"><Link href={routes.accountBooking(b.id)}>{tCommon('actions.viewDetails')}</Link></Button>
                  <Button asChild variant="ghost" size="sm"><Link href={routes.bookingConfirm(b.reference ?? b.id)}>{tBooking('confirmedTitle')}</Link></Button>
                  <Button asChild variant="ghost" size="sm"><Link href={routes.bookingPass(b.id)}>{t('bookings.title')}</Link></Button>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}

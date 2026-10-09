import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { StatusBadge } from '@/components/data/status-badge';
import { CancelBookingButton } from '@/components/booking/cancel-booking-button';
import { RescheduleBookingButton } from '@/components/booking/reschedule-booking-button';
import { routes, site } from '@/config';
import { bookingStatuses, type BookingStatus } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link, redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps { params: Promise<{ locale: string; id: string }>; }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  return buildMetadata({ locale: locale as Locale, path: routes.accountBooking(id), title: t('bookings.title'), noIndex: true });
}

export default async function AccountBookingPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);
  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.accountBooking(id)), locale: locale as Locale });
    return null;
  }
  const booking = await db.booking.findUnique({
    where: { id },
    select: {
      id: true, reference: true, status: true, startsAt: true, endsAt: true, totalPrice: true, basePrice: true, travelFee: true,
      createdAt: true, cancelledAt: true, cancellationReason: true, rescheduleCount: true, maxReschedules: true,
      customerId: true, instructorId: true,
      instructor: { select: { slug: true, user: { select: { name: true } } } },
      venue: { select: { name: true, slug: true } },
      session: { select: { danceClass: { select: { title: true, slug: true } } } },
    },
  }) ?? await db.booking.findUnique({
    where: { reference: id },
    select: {
      id: true, reference: true, status: true, startsAt: true, endsAt: true, totalPrice: true, basePrice: true, travelFee: true,
      createdAt: true, cancelledAt: true, cancellationReason: true, rescheduleCount: true, maxReschedules: true,
      customerId: true, instructorId: true,
      instructor: { select: { slug: true, user: { select: { name: true } } } },
      venue: { select: { name: true, slug: true } },
      session: { select: { danceClass: { select: { title: true, slug: true } } } },
    },
  });
  if (!booking) notFound();
  const isOwner = booking.customerId === caller.id;
  const isStaff = caller.role === 'ADMIN' || caller.role === 'SUPPORT';
  if (!isOwner && !isStaff) notFound();

  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  const tBooking = await getTranslations({ locale: locale as Locale, namespace: 'booking' });
  const tCommon = await getTranslations({ locale: locale as Locale, namespace: 'common' });
  const isCancelled = booking.status === 'CANCELLED_BY_CUSTOMER' || booking.status === 'CANCELLED_BY_PROVIDER';
  const canReschedule = !isCancelled && booking.status !== 'COMPLETED' && (booking.rescheduleCount < booking.maxReschedules);
  const classTitle = (booking as { session?: { danceClass?: { title?: string } } | null }).session?.danceClass?.title;
  const instructorName = (booking as { instructor?: { user?: { name?: string } } | null }).instructor?.user?.name;
  const bookingStatusKnown = (bookingStatuses as readonly string[]).includes(booking.status);
  const bookingStatus = booking.status as BookingStatus;

  const whenLabel = new Date(booking.startsAt).toLocaleString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        {/* Хлебная крошка + статус */}
        <div className="flex flex-wrap items-center gap-2 text-body-sm">
          <Link href={routes.accountBookings()} className="text-content-tertiary hover:text-content-primary">{t('bookings.title')}</Link>
          <span className="text-content-tertiary">/</span>
          <span className="font-mono font-semibold">{booking.reference}</span>
          {bookingStatusKnown ? <StatusBadge kind="booking" status={bookingStatus} size="sm" /> : <Badge variant="neutral" size="sm">{booking.status}</Badge>}
        </div>

        {/* Заголовок — плотнее, без «распутанности» */}
        <h1 className="text-heading-2 mt-3 leading-tight">{classTitle ?? t('bookings.title')}</h1>
        {(instructorName || booking.venue) && (
          <p className="text-body mt-1 truncate text-content-secondary">{[instructorName, booking.venue?.name].filter(Boolean).join(' · ')}</p>
        )}
        <p className="text-body-sm mt-1 font-medium tabular-nums">{whenLabel}</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          {/* Левая — детали как компактная таблица, а не растянутый flex-list */}
          <div className="rounded-xl border border-border-default bg-surface-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-card-title">{tBooking('summaryTitle')}</h2>
              {bookingStatusKnown ? <StatusBadge kind="booking" status={bookingStatus} size="sm" /> : null}
            </div>
            <dl className="mt-4 divide-y divide-border-subtle rounded-lg border border-border-subtle">
              <div className="flex items-center justify-between gap-4 px-3 py-2.5 sm:px-4">
                <dt className="text-caption font-medium tracking-wide text-content-tertiary uppercase">{tBooking('summaryDate')}</dt>
                <dd className="text-body-sm font-medium">{new Date(booking.startsAt).toLocaleDateString(locale)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-3 py-2.5 sm:px-4">
                <dt className="text-caption font-medium tracking-wide text-content-tertiary uppercase">{tBooking('summaryTime')}</dt>
                <dd className="text-body-sm font-medium tabular-nums">{new Date(booking.startsAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} — {new Date(booking.endsAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 bg-surface-sunken px-3 py-2.5 sm:px-4">
                <dt className="text-caption font-medium tracking-wide text-content-tertiary uppercase">{tCommon('labels.total')}</dt>
                <dd><Price amount={booking.totalPrice} emphasis="total" /></dd>
              </div>
              {booking.travelFee > 0 ? (
                <div className="flex items-center justify-between gap-4 px-3 py-2.5 sm:px-4">
                  <dt className="text-caption font-medium tracking-wide text-content-tertiary uppercase">{tBooking('locationCustomer')}</dt>
                  <dd><Price amount={booking.travelFee} /></dd>
                </div>
              ) : null}
              {booking.cancelledAt ? (
                <div className="flex items-center justify-between gap-4 px-3 py-2.5 sm:px-4">
                  <dt className="text-caption font-medium tracking-wide text-content-tertiary uppercase">{tBooking('cancelTitle')}</dt>
                  <dd className="text-body-sm">{new Date(booking.cancelledAt).toLocaleString(locale)}</dd>
                </div>
              ) : null}
            </dl>
            {booking.cancellationReason ? (
              <p className="mt-3 rounded-lg bg-surface-sunken px-3 py-2 text-body-sm text-content-secondary">{booking.cancellationReason}</p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="accent" size="sm"><Link href={routes.bookingPass(booking.id)}>{tBooking('summaryTitle')}</Link></Button>
              <Button asChild variant="outline" size="sm"><Link href={routes.bookingConfirm(booking.reference)}>{tBooking('confirmedTitle')}</Link></Button>
              {booking.instructor?.slug ? <Button asChild variant="ghost" size="sm"><Link href={routes.instructor(booking.instructor.slug)}>{tCommon('labels.instructor')}</Link></Button> : null}
            </div>
          </div>

          {/* Правая — действия, отдельно от деталей */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border-default bg-surface-card p-5">
              <h2 className="text-body-sm font-semibold uppercase tracking-wide text-content-tertiary">{tCommon('actions.viewDetails')}</h2>
              {!isCancelled && booking.status !== 'COMPLETED' ? (
                <div className="mt-4 grid gap-3">
                  {canReschedule ? <RescheduleBookingButton bookingId={booking.id} /> : null}
                  <CancelBookingButton bookingId={booking.id} />
                  <p className="text-caption leading-relaxed text-content-tertiary">{tBooking('cancellationNote', { hours: String(24) } as never)}</p>
                </div>
              ) : (
                <p className="mt-3 text-body-sm text-content-secondary">{isCancelled ? tBooking('cancelTitle') : tBooking('confirmedTitle')}</p>
              )}
            </div>
            <div className="rounded-xl bg-surface-sunken px-4 py-3 text-caption leading-relaxed text-content-tertiary">
              <span className="font-mono font-semibold text-content-secondary">{booking.reference}</span> · {tBooking('summaryDate')}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

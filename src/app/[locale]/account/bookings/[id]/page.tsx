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

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        <div className="flex flex-wrap items-center gap-2 text-body-sm">
          <Link href={routes.accountBookings()} className="text-content-tertiary hover:text-content-primary">{t('bookings.title')}</Link>
          <span className="text-content-tertiary">/</span>
          <span className="font-mono font-semibold">{booking.reference}</span>
          {bookingStatusKnown ? <StatusBadge kind="booking" status={bookingStatus} size="sm" /> : <Badge variant="neutral" size="sm">{booking.status}</Badge>}
        </div>

        <h1 className="text-heading-2 mt-3">{classTitle ?? t('bookings.title')}</h1>
        {instructorName && <p className="text-body mt-1 text-content-secondary">{instructorName}{booking.venue ? ` · ${booking.venue.name}` : ''}</p>}

        <div className="mt-6 rounded-xl border border-border-default bg-surface-card p-6">
          <dl className="grid gap-2 text-body-sm">
            <div className="flex justify-between gap-4"><dt className="text-content-tertiary">{tBooking('summaryDate')}</dt><dd className="font-medium">{new Date(booking.startsAt).toLocaleString(locale)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-content-tertiary">{tBooking('summaryTime')}</dt><dd className="font-medium">{new Date(booking.startsAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} — {new Date(booking.endsAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-content-tertiary">{tCommon('labels.total')}</dt><dd><Price amount={booking.totalPrice} emphasis="total" /></dd></div>
            {booking.travelFee > 0 && <div className="flex justify-between gap-4"><dt className="text-content-tertiary">{tBooking('locationCustomer')}</dt><dd><Price amount={booking.travelFee} /></dd></div>}
            {booking.cancelledAt && <div className="flex justify-between gap-4"><dt className="text-content-tertiary">{tBooking('cancelTitle')}</dt><dd>{new Date(booking.cancelledAt).toLocaleString(locale)}</dd></div>}
          </dl>

          {!isCancelled && booking.status !== 'COMPLETED' && (
            <div className="mt-4 flex flex-wrap gap-3">
              <CancelBookingButton bookingId={booking.id} />
              {canReschedule && <RescheduleBookingButton bookingId={booking.id} />}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="outline"><Link href={routes.bookingPass(booking.id)}>{tBooking('summaryTitle')}</Link></Button>
            <Button asChild variant="ghost"><Link href={routes.bookingConfirm(booking.reference)}>{tBooking('confirmedTitle')}</Link></Button>
            {booking.instructor?.slug && <Button asChild variant="ghost"><Link href={routes.instructor(booking.instructor.slug)}>{tCommon('labels.instructor')}</Link></Button>}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

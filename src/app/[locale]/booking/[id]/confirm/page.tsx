import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getCaller } from '@/lib/auth/guards';
import { Price } from '@/components/ui/price';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/data/status-badge';
import { CancelBookingButton } from '@/components/booking/cancel-booking-button';
import { RescheduleBookingButton } from '@/components/booking/reschedule-booking-button';
import { routes, site } from '@/config';
import { bookingStatuses, type BookingStatus } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link, redirect } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { buildMetadata } from '@/lib/seo/metadata';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'booking' });
  return buildMetadata({
    locale: locale as Locale,
    path: routes.bookingConfirm(id),
    title: t('confirmedTitle'),
    noIndex: true,
  });
}

export default async function BookingConfirmPage({ params }: PageProps) {
  const { id, locale } = await params;
  setRequestLocale(locale as Locale);
  const tBooking = await getTranslations({ locale: locale as Locale, namespace: 'booking' });
  const tAccount = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  const tCommon = await getTranslations({ locale: locale as Locale, namespace: 'common' });
  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.bookingConfirm(id)), locale: locale as Locale });
    return null;
  }
  const booking = await db.booking.findUnique({
    where: { id },
    select: {
      id: true, reference: true, totalPrice: true, basePrice: true, travelFee: true,
      startsAt: true, endsAt: true, status: true, customerId: true,
      rescheduleCount: true, maxReschedules: true, rescheduleWindowHours: true,
      cancellationWindowHours: true, lateCancellationRate: true,
      instructor: { select: { slug: true, user: { select: { name: true } } } },
      session: { select: { danceClass: { select: { title: true, slug: true } } } },
    },
  });
  const resolved = booking
    ?? await db.booking.findUnique({
        where: { reference: id },
        select: {
          id: true, reference: true, totalPrice: true, basePrice: true, travelFee: true,
          startsAt: true, endsAt: true, status: true, customerId: true,
          rescheduleCount: true, maxReschedules: true, rescheduleWindowHours: true,
          cancellationWindowHours: true, lateCancellationRate: true,
          instructor: { select: { slug: true, user: { select: { name: true } } } },
          session: { select: { danceClass: { select: { title: true, slug: true } } } },
        },
      });
  // Hold ещё жив, но брони нет — человек перезагрузил страницу до POST /api/booking
  // Не 404: мягкая подсказка вернуться к экрану бронирования.
  if (!resolved) {
    const hold = await db.slotHold.findUnique({ where: { id }, select: { id: true, instructorId: true, expiresAt: true } });
    if (hold) {
      const isExpired = hold.expiresAt.getTime() <= new Date().getTime();
      const instructor = hold.instructorId
        ? await db.instructorProfile.findUnique({ where: { id: hold.instructorId }, select: { slug: true } })
        : null;
      const backHref = instructor ? routes.instructorBooking(instructor.slug) : routes.booking();
      return (
        <main id={site.mainContentId} className="page-container inner-page">
          <h1 className="text-heading-2">{tBooking('holdExpired')}</h1>
          <p className="text-body mt-2 text-content-secondary">
            {isExpired ? tBooking('holdExpired') : tBooking('holdNotice', { minutes: String(15) } as never)}
          </p>
          <div className="mt-6 flex gap-3">
            <Button asChild variant="accent"><Link href={backHref}>{tCommon('actions.continue')}</Link></Button>
            <Button asChild variant="outline"><Link href={routes.accountBookings()}>{tAccount('bookings.title')}</Link></Button>
          </div>
        </main>
      );
    }
    notFound();
  }
  const isOwner = resolved.customerId === caller.id;
  const isStaff = caller.role === 'ADMIN' || caller.role === 'SUPPORT';
  if (!isOwner && !isStaff) notFound();
  const isCancelled = resolved.status === 'CANCELLED_BY_CUSTOMER' || resolved.status === 'CANCELLED_BY_PROVIDER';
  const canReschedule = !isCancelled && resolved.status !== 'COMPLETED' && resolved.rescheduleCount < resolved.maxReschedules;
  const classTitle = (resolved as { session?: { danceClass?: { title?: string } } | null }).session?.danceClass?.title;
  const instructorName = (resolved as { instructor?: { user?: { name?: string } } | null }).instructor?.user?.name;
  return (
    <main id={site.mainContentId} className="page-container inner-page min-w-0">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-heading-2 break-words [overflow-wrap:anywhere]">{isCancelled ? tBooking('cancelTitle') : tBooking('confirmedTitle')}</h1>
          <p className="text-body mt-2 flex min-w-0 flex-wrap items-center gap-2 break-words text-content-secondary [overflow-wrap:anywhere]">
            <span className="min-w-0 break-all">{tAccount('orders.orderNumber', { number: resolved.reference } as never)}</span>
            {(bookingStatuses as readonly string[]).includes(resolved.status) ? <StatusBadge kind="booking" status={resolved.status as BookingStatus} size="sm" className="max-w-full break-words" /> : <Badge variant="metal" size="sm" className="max-w-full break-words">{resolved.status}</Badge>}
          </p>
          {(classTitle || instructorName) && (
            <p className="text-body-sm mt-1 break-words text-content-tertiary [overflow-wrap:anywhere]">{[classTitle, instructorName].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        <div className="max-w-full shrink-0">
          {(bookingStatuses as readonly string[]).includes(resolved.status) ? <StatusBadge kind="booking" status={resolved.status as BookingStatus} className="max-w-full break-words" /> : <Badge variant={isCancelled ? 'warning' : 'success'} className="max-w-full break-words">{isCancelled ? tBooking('cancelTitle') : resolved.status}</Badge>}
        </div>
      </div>
      <div className="mt-6 min-w-0 overflow-hidden rounded-xl border border-border-default bg-surface-card p-4 sm:p-6">
        <dl className="grid min-w-0 gap-2 text-body-sm">
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4"><dt className="shrink-0 text-content-tertiary">{tBooking('summaryDate')}</dt><dd className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">{new Date(resolved.startsAt).toLocaleString(locale)}</dd></div>
          <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4"><dt className="shrink-0 text-content-tertiary">{tBooking('summaryTime')}</dt><dd className="min-w-0 break-words font-medium tabular-nums [overflow-wrap:anywhere]">{new Date(resolved.startsAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} — {new Date(resolved.endsAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</dd></div>
          <div className="flex min-w-0 items-center justify-between gap-4"><dt className="shrink-0 text-content-tertiary">{tCommon('labels.total')}</dt><dd className="min-w-0"><Price amount={resolved.totalPrice} emphasis="total" /></dd></div>
          {(resolved as { basePrice?: number }).basePrice != null && (resolved as { travelFee?: number }).travelFee! > 0 && (
            <div className="flex min-w-0 items-center justify-between gap-4"><dt className="shrink-0 text-content-tertiary">{tBooking('locationCustomer')}</dt><dd className="min-w-0"><Price amount={(resolved as { travelFee: number }).travelFee!} /></dd></div>
          )}
        </dl>
        <p className="text-caption mt-3 break-words text-content-tertiary [overflow-wrap:anywhere]">{tBooking('cancellationNote', { hours: String(resolved.cancellationWindowHours) } as never)}</p>
        {!isCancelled && resolved.status !== 'COMPLETED' && (
          <div className="mt-4 grid min-w-0 gap-3">
            <CancelBookingButton bookingId={resolved.id} />
            {canReschedule && <RescheduleBookingButton bookingId={resolved.id} />}
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="outline" className="max-w-full break-words"><Link href={routes.bookingPass(resolved.id)}>{tBooking('summaryTitle')}</Link></Button>
          <Button asChild variant="ghost" className="max-w-full break-words"><Link href={routes.accountBookings()}>{tAccount('bookings.title')}</Link></Button>
          <Button asChild variant="accent" className="max-w-full break-words"><Link href={routes.account()}>{tCommon('actions.continue')}</Link></Button>
        </div>
      </div>
    </main>
  );
}

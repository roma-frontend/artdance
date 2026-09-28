import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { getCaller } from '@/lib/auth/guards';
import { Price } from '@/components/ui/price';
import { CancelBookingButton } from '@/components/booking/cancel-booking-button';
import { RescheduleBookingButton } from '@/components/booking/reschedule-booking-button';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export default async function BookingConfirmPage({ params }: { params: Promise<{ locale: string; holdId: string }> }) {
  const { holdId, locale } = await params;
  const tBooking = await getTranslations({ locale: locale as never, namespace: 'booking' });
  const tAccount = await getTranslations({ locale: locale as never, namespace: 'account' });
  const tCommon = await getTranslations({ locale: locale as never, namespace: 'common' });
  const caller = await getCaller();
  if (!caller) notFound();
  const booking = await db.booking.findUnique({ where: { id: holdId }, select: { id:true, reference:true, totalPrice:true, startsAt:true, endsAt:true, status:true, customerId:true, rescheduleCount:true, maxReschedules:true, rescheduleWindowHours:true, cancellationWindowHours:true, lateCancellationRate:true } });
  const resolved = booking ?? await db.booking.findUnique({ where: { reference: holdId }, select: { id:true, reference:true, totalPrice:true, startsAt:true, endsAt:true, status:true, customerId:true, rescheduleCount:true, maxReschedules:true, rescheduleWindowHours:true, cancellationWindowHours:true, lateCancellationRate:true } });
  if (!resolved || resolved.customerId !== caller.id) notFound();
  const isCancelled = resolved.status === 'CANCELLED_BY_CUSTOMER' || resolved.status === 'CANCELLED_BY_PROVIDER';
  const canReschedule = !isCancelled && resolved.status !== 'COMPLETED' && resolved.rescheduleCount < resolved.maxReschedules;
  return (
    <main className="page-container inner-page">
      <h1 className="text-heading-2">{isCancelled ? tBooking('cancelTitle') : tBooking('confirmedTitle')}</h1>
      <p className="text-body mt-2 text-content-secondary">{tAccount('orders.orderNumber', { number: resolved.reference })} · {resolved.status} · {tBooking('rescheduleLimit')}</p>
      <div className="mt-6 rounded-xl border border-border-default bg-surface-card p-6">
        <div className="text-body-sm mt-2">{resolved.startsAt.toISOString()} — {resolved.endsAt.toISOString()}</div>
        <div className="mt-3"><Price amount={resolved.totalPrice} /></div>
        {!isCancelled && resolved.status !== 'COMPLETED' && <CancelBookingButton bookingId={resolved.id} />}
        {canReschedule && <RescheduleBookingButton bookingId={resolved.id} />}
        <div className="mt-4"><Button asChild variant="outline"><Link href={routes.account()}>{tCommon('actions.continue')}</Link></Button></div>
      </div>
    </main>
  );
}

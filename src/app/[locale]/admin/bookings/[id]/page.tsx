/**
 * БРОНЬ — карточка операции.
 *
 * Главный блок здесь — «условия, зафиксированные при брони». Он существует не для
 * красоты: окно отмены, ставка удержания, окно переноса и предел переносов
 * записаны в саму бронь в момент создания, и спор через месяц решается ими, а не
 * текущим конфигом. Поэтому они показаны как данные записи, а не как настройки.
 *
 * Отмена доступна администратору даже там, где клиенту она уже закрыта — это
 * работа поддержки. Но удержание и возврат считаются по зафиксированным условиям
 * (`cancellationOutcome`), а не «по договорённости».
 */

import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BookingStatusActions } from '@/components/admin/status-actions';
import { StatusBadge } from '@/components/data/status-badge';
import { AccessDenied } from '@/components/ui/access-denied';
import { routes } from '@/config';
import type { BookingStatus } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { getBookingDetail } from '@/server/admin/operations';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

/** Переходы, не связанные с отменой: у отмены свой диалог с причиной и расчётом. */
const transitions: Record<string, readonly BookingStatus[]> = {
  PENDING: ['CONFIRMED', 'EXPIRED'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW'],
  WAITLISTED: ['CONFIRMED'],
  COMPLETED: [],
  NO_SHOW: [],
  RESCHEDULED: [],
  EXPIRED: [],
  CANCELLED_BY_CUSTOMER: [],
  CANCELLED_BY_PROVIDER: [],
};

export default async function AdminBookingPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  if (!can('bookings.view')) return <AccessDenied />;

  const booking = await getBookingDetail(id);
  if (!booking) notFound();

  const t = await getTranslations('admin.bookings');
  const tRoot = await getRootTranslate();
  const format = await getFormatter();

  const cancellable =
    can('bookings.cancel') && (booking.status === 'PENDING' || booking.status === 'CONFIRMED');

  return (
    <>
      <AdminPageHeader
        title={booking.reference}
        parent={{ href: routes.adminBookings(), labelKey: 'admin.bookings.title' }}
        actions={<StatusBadge kind="booking" status={booking.status} size="md" />}
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <section aria-labelledby="booking-main" className="lg:col-span-2">
          <h2 id="booking-main" className="text-card-title mb-4 text-content-primary">
            {tRoot('admin.form.generalSection')}
          </h2>

          <dl className="flex flex-col gap-2">
            <Row
              label={tRoot('admin.fields.type')}
              value={tRoot(`admin.enums.bookingSubject.${booking.subject}`)}
            />
            <Row
              label={tRoot('admin.fields.startsAt')}
              value={format.dateTime(booking.startsAt, 'bookingStamp')}
            />
            <Row
              label={tRoot('admin.fields.endsAt')}
              value={format.dateTime(booking.endsAt, 'bookingStamp')}
            />
            <Row label={tRoot('admin.fields.customer')} value={booking.customer.name} />
            <Row label={tRoot('admin.fields.email')} value={booking.customer.email} />
            {booking.instructor ? (
              <Row label={tRoot('admin.fields.instructor')} value={booking.instructor.user.name} />
            ) : null}
            {booking.venue ? <Row label={tRoot('admin.fields.venue')} value={booking.venue.name} /> : null}
            {booking.room ? <Row label={tRoot('admin.fields.room')} value={booking.room.name} /> : null}
            <Row
              label={tRoot('admin.fields.locationOption')}
              value={tRoot(`admin.enums.locationOption.${booking.locationOption}`)}
            />
            <Row
              label={tRoot('admin.fields.participants')}
              value={format.number(booking.participants, 'plain')}
            />
            <Row label={tRoot('admin.fields.basePrice')} value={format.number(booking.basePrice, 'price')} />
            <Row label={tRoot('admin.fields.travelFee')} value={format.number(booking.travelFee, 'price')} />
            <Row
              label={tRoot('admin.fields.discountTotal')}
              value={format.number(booking.discountAmount, 'price')}
            />
            <Row label={tRoot('admin.fields.total')} value={format.number(booking.totalPrice, 'price')} />
            {booking.cancellationReason ? (
              <Row label={tRoot('admin.fields.reason')} value={booking.cancellationReason} />
            ) : null}
          </dl>
        </section>

        <aside className="flex flex-col gap-8">
          <section aria-labelledby="booking-status">
            <h2 id="booking-status" className="text-card-title mb-4 text-content-primary">
              {tRoot('admin.fields.status')}
            </h2>
            {can('bookings.edit') || cancellable ? (
              <BookingStatusActions
                id={booking.id}
                transitions={can('bookings.edit') ? (transitions[booking.status] ?? []) : []}
                cancellable={cancellable}
              />
            ) : null}
          </section>

          <section aria-labelledby="booking-policy">
            <h2 id="booking-policy" className="text-card-title mb-2 text-content-primary">
              {t('policySection')}
            </h2>
            <p className="text-caption mb-4 text-content-tertiary">{t('policyNotice')}</p>

            <dl className="flex flex-col gap-2">
              <Row
                label={tRoot('admin.fields.validUntil')}
                value={tRoot('common.units.hours', { count: booking.cancellationWindowHours })}
              />
              <Row
                label={tRoot('admin.fields.commissionRate')}
                value={format.number(Number(booking.lateCancellationRate), 'percent')}
              />
              <Row
                label={tRoot('admin.fields.rescheduleWindow')}
                value={tRoot('common.units.hours', { count: booking.rescheduleWindowHours })}
              />
              <Row
                label={tRoot('admin.fields.maxReschedules')}
                value={`${format.number(booking.rescheduleCount, 'plain')} / ${format.number(booking.maxReschedules, 'plain')}`}
              />
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2">
      <dt className="text-caption uppercase text-content-tertiary">{label}</dt>
      <dd className="text-body-sm text-content-primary">{value}</dd>
    </div>
  );
}

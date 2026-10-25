/**
 * АРЕНДА ЗАЛА — страница бронирования зала.
 *
 * Доступна только при включённой функции `events` и только вошедшим пользователям:
 * аренда создаётся PENDING и подтверждается оплатой на странице брони. Выбор зала,
 * времени и длительности проверяет сервер (hold и бронь), здесь только форма.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { RentalBookingForm } from '@/components/booking/rental-booking-form';
import { routes, site } from '@/config';
import { venue } from '@/config/business';
import { zonedDateKey } from '@/domain/availability/compute';
import type { Locale } from '@/i18n/config';
import { Link, redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';
import { assertEntitlementOrNotFound } from '@/server/entitlements/guard';
import { getRentableRooms } from '@/server/queries/venues';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'studio.rent' });
  return buildMetadata({
    locale: locale as Locale,
    path: routes.studioBooking(slug),
    title: t('title'),
    noIndex: true,
  });
}

/** Длительности аренды по сетке из конфига: от минимума до максимума с шагом. */
function rentalDurationOptions(): number[] {
  const options: number[] = [];
  for (let minutes = venue.minRentalMinutes; minutes <= venue.maxRentalMinutes; minutes += venue.rentalGranularityMinutes) {
    options.push(minutes);
  }
  return options;
}

export default async function StudioBookPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  await assertEntitlementOrNotFound('events');

  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.studioBooking(slug)), locale: locale as Locale });
    return null;
  }

  const rentable = await getRentableRooms(slug);
  if (!rentable || rentable.rooms.length === 0) notFound();

  const t = await getTranslations('studio.rent');

  return (
    <main id={site.mainContentId} className="page-container inner-page min-w-0">
      <p className="text-eyebrow text-content-tertiary">{rentable.name}</p>
      <h1 className="text-heading-2 mt-1 break-words">{t('title')}</h1>
      <p className="text-body mt-2 max-w-(--layout-prose-max-width) text-content-secondary">{t('subtitle')}</p>

      <div className="mt-8 max-w-2xl">
        <RentalBookingForm
          rooms={rentable.rooms}
          minDate={zonedDateKey(new Date(), site.timeZone)}
          durationOptions={rentalDurationOptions()}
        />
      </div>

      <p className="text-body-sm mt-8">
        <Link href={routes.studio(slug)} className="font-semibold text-content-accent underline">
          {t('backToVenue')}
        </Link>
      </p>
    </main>
  );
}

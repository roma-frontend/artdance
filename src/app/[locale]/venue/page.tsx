import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Price } from '@/components/ui/price';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';
import { assertEntitlementOrNotFound } from '@/server/entitlements/guard';
import { getVenueDashboard } from '@/server/venue/dashboard';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: routes.venueDashboard(), title: t('venueDashboardTitle'), noIndex: true });
}

export default async function VenuePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await assertEntitlementOrNotFound('events');
  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.venueDashboard()), locale: locale as Locale });
    return null;
  }
  const { venues, bookings } = await getVenueDashboard(caller.id);
  const tFooter = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  const tAdmin = await getTranslations({ locale: locale as Locale, namespace: 'admin' });
  const format = await getFormatter({ locale: locale as Locale });
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{tFooter('venueDashboardTitle')}</h1>
      <p className="text-body mt-2 text-content-secondary">{tFooter('venueDashboardHint')}</p>
      {venues.length === 0 ? (
        <div className="mt-10">
          <EmptyState title={tFooter('venueDashboardEmpty')} />
        </div>
      ) : (
        venues.map((venue) => {
          const venueBookings = bookings.filter((booking) => booking.venueId === venue.id);
          return (
            <section key={venue.id} className="mt-10">
              <h2 className="text-heading-3">{venue.name}</h2>
              <p className="text-body-sm text-content-tertiary">{venue.district}</p>

              <h3 className="text-card-title mt-6">{tFooter('venueDashboardRooms')}</h3>
              {venue.rooms.length === 0 ? (
                <p className="text-body mt-2 text-content-secondary">{tFooter('venueDashboardNoRooms')}</p>
              ) : (
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {venue.rooms.map((room) => (
                    <li key={room.id} className="rounded-xl border border-border-default bg-surface-card p-4">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-body font-semibold text-content-primary">{room.name}</span>
                        {!room.isActive && (
                          <Badge variant="neutral" size="sm">{tFooter('venueDashboardRoomInactive')}</Badge>
                        )}
                      </div>
                      <p className="text-body-sm mt-1 text-content-tertiary">{tFooter('venueDashboardCapacity', { count: room.capacity })}</p>
                      <Price amount={room.pricePerHour} unit="perHour" className="mt-2" />
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="text-card-title mt-8">{tFooter('venueDashboardUpcoming')}</h3>
              {venueBookings.length === 0 ? (
                <p className="text-body mt-2 text-content-secondary">{tFooter('venueDashboardNoBookings')}</p>
              ) : (
                <ul className="mt-3 divide-y divide-border-default">
                  {venueBookings.map((booking) => (
                    <li key={booking.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                      <span className="text-body text-content-primary">
                        {tAdmin(`enums.bookingSubject.${booking.subject}`)}
                        {booking.room ? ` · ${booking.room.name}` : ''}
                      </span>
                      <span className="text-body-sm text-content-tertiary tabular-nums">
                        {format.dateTime(booking.startsAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {format.dateTime(booking.endsAt, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-body-sm font-mono text-content-tertiary">{booking.reference}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
      <SiteFooter />
    </main>
  );
}

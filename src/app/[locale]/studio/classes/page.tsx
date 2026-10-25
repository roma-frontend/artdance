import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { EmptyState } from '@/components/ui/empty-state';
import { SessionRoomSelect } from '@/components/venue/session-room-select';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { requireInstructorProfile } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';
import { assertEntitlementOrNotFound } from '@/server/entitlements/guard';
import { getActiveVenueRooms, getInstructorUpcomingSessions } from '@/server/venue/room-assignment';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'studio.classes' });
  return buildMetadata({ locale: locale as Locale, path: routes.instructorClasses(), title: t('title'), noIndex: true });
}

export default async function StudioClassesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await assertEntitlementOrNotFound('events');
  const { instructorId } = await requireInstructorProfile();

  const sessions = await getInstructorUpcomingSessions(instructorId);
  const rooms = await getActiveVenueRooms([...new Set(sessions.map((session) => session.venue.id))]);

  const t = await getTranslations({ locale: locale as Locale, namespace: 'studio.classes' });
  const tFooter = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  const format = await getFormatter({ locale: locale as Locale });

  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('title')}</h1>
      <p className="text-body mt-2 text-content-secondary">{t('subtitle')}</p>

      {sessions.length === 0 ? (
        <div className="mt-10">
          <EmptyState title={t('empty')} />
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-border-default">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 py-3">
              <div className="flex flex-col">
                <span className="text-body text-content-primary">{session.title}</span>
                <span className="text-body-sm text-content-tertiary">{session.venue.name}</span>
                <span className="text-body-sm text-content-tertiary tabular-nums">
                  {format.dateTime(session.startsAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {' – '}
                  {format.dateTime(session.endsAt, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <SessionRoomSelect
                sessionId={session.id}
                roomId={session.roomId}
                rooms={rooms
                  .filter((room) => room.venueId === session.venue.id)
                  .map(({ id, name }) => ({ id, name }))}
                noRoomLabel={tFooter('venueDashboardNoRoom')}
                label={tFooter('venueDashboardRoomLabel')}
              />
            </li>
          ))}
        </ul>
      )}

      <SiteFooter />
    </main>
  );
}

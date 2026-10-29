import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteFooter } from '@/components/layout/site-footer';
import { BookingRequestActions } from '@/components/studio/booking-request-actions';
import { EmptyState } from '@/components/ui/empty-state';
import { routes, site } from '@/config';
import { bookingSubjectLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { getRootTranslate } from '@/i18n/translate';
import { requireInstructorProfile } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';
import { listOpenBookingRequests } from '@/server/booking/requests';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'studio.requests' });
  return buildMetadata({ locale: locale as Locale, path: routes.instructorRequests(), title: t('title'), noIndex: true });
}

export default async function StudioRequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const { instructorId } = await requireInstructorProfile();

  const requests = await listOpenBookingRequests(instructorId, new Date());

  const t = await getTranslations({ locale: locale as Locale, namespace: 'studio.requests' });
  const tRoot = await getRootTranslate();
  const format = await getFormatter({ locale: locale as Locale });

  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('title')}</h1>
      <p className="text-body mt-2 text-content-secondary">{t('subtitle')}</p>

      {requests.length === 0 ? (
        <div className="mt-10">
          <EmptyState title={t('empty')} />
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-border-default">
          {requests.map((request) => {
            const title = request.session?.danceClass.title ?? tRoot(bookingSubjectLabelKey(request.subject));
            const firstName = request.customer.name.trim().split(/\s+/)[0] ?? '';
            const deadline = request.requestExpiresAt
              ? format.dateTime(request.requestExpiresAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
              : null;
            return (
              <li key={request.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="text-body text-content-primary">{title}</span>
                  <span className="text-body-sm text-content-tertiary">
                    {[firstName, t('participants', { count: request.participants })].filter(Boolean).join(' · ')}
                  </span>
                  <span className="text-body-sm text-content-tertiary tabular-nums">
                    {format.dateTime(request.startsAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {format.dateTime(request.endsAt, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {deadline ? (
                    <span className="text-body-sm font-medium text-content-secondary tabular-nums">
                      {t('deadline', { when: deadline })}
                    </span>
                  ) : null}
                </div>
                <BookingRequestActions bookingId={request.id} />
              </li>
            );
          })}
        </ul>
      )}

      <SiteFooter />
    </main>
  );
}

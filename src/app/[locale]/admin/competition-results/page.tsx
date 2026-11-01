/**
 * РЕЗУЛЬТАТЫ СОРЕВНОВАНИЙ — админ записывает места атлетов после соревнований.
 * Места питают рейтинг и достижения в кабинете атлета (DS-04).
 */

import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { CompetitionResultForm } from '@/components/admin/competition-result-form';
import { AccessDenied } from '@/components/ui/access-denied';
import { EmptyState } from '@/components/ui/empty-state';
import type { Locale } from '@/i18n/config';
import { adminAccess } from '@/server/admin/access';
import { recentCompetitionResults, registrationsAwaitingResult } from '@/server/athlete/results';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminCompetitionResultsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  if (!can('content.manage')) return <AccessDenied />;

  const [awaiting, recent, t, tPlace, format] = await Promise.all([
    registrationsAwaitingResult(),
    recentCompetitionResults(),
    getTranslations({ locale: locale as Locale, namespace: 'competitionResults.admin' }),
    getTranslations({ locale: locale as Locale, namespace: 'competitionPlace' }),
    getFormatter(),
  ]);

  return (
    <>
      <AdminPageHeader titleKey="competitionResults.admin.title" subtitleKey="competitionResults.admin.subtitle" />

      <section className="rounded-xl border border-border-default bg-surface-card p-5 shadow-sm">
        <CompetitionResultForm registrations={awaiting} />
      </section>

      <section className="mt-8">
        <h2 className="text-card-title mb-3">{t('recentTitle')}</h2>
        {recent.length === 0 ? (
          <EmptyState title={t('recentEmpty')} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-card">
            <table className="w-full text-left text-body-sm">
              <thead className="text-label text-content-secondary">
                <tr>
                  <th className="px-4 py-3">{t('athlete')}</th>
                  <th className="px-4 py-3">{t('event')}</th>
                  <th className="px-4 py-3">{t('category')}</th>
                  <th className="px-4 py-3">{t('place')}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.id} className="border-t border-border-subtle">
                    <td className="px-4 py-3">{row.athleteName}</td>
                    <td className="px-4 py-3">
                      {row.eventTitle}
                      <span className="text-caption block text-content-tertiary">
                        {format.dateTime(row.eventStartsAt, { dateStyle: 'medium' })}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.categoryName}</td>
                    <td className="px-4 py-3">{tPlace(row.place)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

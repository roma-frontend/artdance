/**
 * ПРОФИЛЬ АТЛЕТА (DS-04) — программы, клуб, разряд и регистрации на соревнования.
 *
 * Профиль создаёт регистрация на соревнование. Без неё кабинет пуст, и страница
 * объясняет, как он появится, а не показывает пустую форму.
 */

import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { AccountNav } from '@/components/account/account-nav';
import { AthleteProfileForm } from '@/components/account/athlete-profile-form';
import { ratingWindowMonths } from '@/domain/athlete-rating';
import { SiteFooter } from '@/components/layout/site-footer';
import { EmptyState } from '@/components/ui/empty-state';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';
import { athleteCabinetFor } from '@/server/athlete/service';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';

interface PageProps { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'athlete.cabinet' });
  return buildMetadata({ locale: locale as Locale, path: routes.accountAthlete(), title: t('title'), noIndex: true });
}

export default async function AccountAthletePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.accountAthlete()), locale: locale as Locale });
    return null;
  }

  const t = await getTranslations('athlete.cabinet');
  const tPlace = await getTranslations('competitionPlace');
  const format = await getFormatter({ locale: locale as Locale });
  const entitlements = await getEffectiveEntitlementsSafe();
  const athlete = await athleteCabinetFor(caller.id);

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        <h1 className="text-heading-2">{t('title')}</h1>
        <AccountNav locale={locale as Locale} pathname={routes.accountAthlete()} entitlements={entitlements} />

        {!athlete ? (
          <div className="mt-6">
            <EmptyState title={t('notRegistered')} />
          </div>
        ) : (
          <>
            <section aria-labelledby="athlete-profile" className="mt-6 rounded-xl border border-border-default bg-surface-card p-6 shadow-sm">
              <h2 id="athlete-profile" className="text-card-title">{t('profileTitle')}</h2>
              {athlete.wdsfId ? (
                <p className="text-body-sm mt-2 text-content-secondary">
                  {t('wdsfId')}: <span className="font-mono">{athlete.wdsfId}</span>
                </p>
              ) : null}
              <div className="mt-4">
                <AthleteProfileForm
                  initial={{ programs: athlete.programs, clubName: athlete.clubName, rank: athlete.rank }}
                />
              </div>
            </section>

            <section aria-labelledby="athlete-rating" className="mt-6 rounded-xl border border-border-default bg-surface-card p-6 shadow-sm">
              <h2 id="athlete-rating" className="text-card-title">{t('ratingTitle')}</h2>
              <p className="mt-2 text-heading-3">{athlete.rating}</p>
              <p className="text-body-sm mt-1 text-content-secondary">{t('ratingNote', { months: ratingWindowMonths })}</p>

              <h3 className="text-label mt-6 text-content-secondary">{t('achievementsTitle')}</h3>
              {athlete.achievements.length === 0 ? (
                <p className="text-body-sm mt-2 text-content-tertiary">{t('noAchievements')}</p>
              ) : (
                <ul className="mt-2 divide-y divide-border-default">
                  {athlete.achievements.map((item) => (
                    <li key={`${item.eventSlug}-${item.categoryName}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <span className="text-body-sm">
                        {item.eventTitle} · {item.categoryName}
                        <span className="text-caption block text-content-tertiary">
                          {format.dateTime(item.eventStartsAt, { dateStyle: 'medium' })}
                        </span>
                      </span>
                      <span className="text-body-sm font-medium">{tPlace(item.place)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="athlete-registrations" className="mt-6">
              <h2 id="athlete-registrations" className="text-card-title">{t('registrationsTitle')}</h2>
              {athlete.registrations.length === 0 ? (
                <p className="text-body-sm mt-3 text-content-tertiary">{t('noRegistrations')}</p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border border-border-default bg-surface-card">
                  <table className="w-full text-left text-body-sm">
                    <thead className="text-label text-content-secondary">
                      <tr>
                        <th className="px-4 py-3">{t('event')}</th>
                        <th className="px-4 py-3">{t('category')}</th>
                        <th className="px-4 py-3">{t('partner')}</th>
                        <th className="px-4 py-3">{t('statusHeader')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {athlete.registrations.map((row) => (
                        <tr key={row.id} className="border-t border-border-subtle">
                          <td className="px-4 py-3">
                            {row.event.title}
                            <span className="text-caption block text-content-tertiary">
                              {format.dateTime(row.event.startsAt, { dateStyle: 'medium' })}
                            </span>
                          </td>
                          <td className="px-4 py-3">{row.category.name}</td>
                          <td className="px-4 py-3">{row.partnerName ?? '—'}</td>
                          <td className="px-4 py-3">{t(`statuses.${row.status}`)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        <SiteFooter />
      </main>
    </>
  );
}

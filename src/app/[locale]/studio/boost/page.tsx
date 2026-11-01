import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { BoostRequestForm } from '@/components/studio/boost-request-form';
import { EmptyState } from '@/components/ui/empty-state';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { requireInstructorProfile } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';
import { instructorBoosts } from '@/server/boost/service';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'boost' });
  return buildMetadata({ locale: locale as Locale, path: routes.instructorStudioBoost(), title: t('studio.title'), noIndex: true });
}

/**
 * Продвижение в выдаче: заявки инструктора и их статус. Одобренная кампания поднимает
 * размещение на её срок; до модерации ничего не меняется.
 */
export default async function StudioBoostPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const { instructorId } = await requireInstructorProfile();

  const t = await getTranslations({ locale: locale as Locale, namespace: 'boost' });
  const format = await getFormatter();
  const entitlements = await getEffectiveEntitlementsSafe();
  const campaigns = await instructorBoosts(instructorId);

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        <h1 className="text-heading-2">{t('studio.title')}</h1>
        <p className="text-body mt-2 text-content-secondary">{t('studio.intro')}</p>

        {entitlements.boost ? (
          <section className="mt-6 rounded-xl border border-border-default bg-surface-card p-5 shadow-sm">
            <h2 className="text-card-title mb-4">{t('studio.newRequest')}</h2>
            <BoostRequestForm />
          </section>
        ) : (
          <p role="note" className="text-body-sm mt-6 text-content-secondary">{t('studio.notIncluded')}</p>
        )}

        <section className="mt-6">
          <h2 className="text-card-title mb-3">{t('studio.history')}</h2>
          {campaigns.length === 0 ? (
            <EmptyState title={t('studio.empty')} />
          ) : (
            <ul className="flex flex-col gap-3">
              {campaigns.map((campaign) => (
                <li key={campaign.id} className="rounded-xl border border-border-default bg-surface-card p-4">
                  <p className="text-body-sm">
                    {format.dateTime(campaign.startsAt, { dateStyle: 'medium' })} — {format.dateTime(campaign.endsAt, { dateStyle: 'medium' })}
                  </p>
                  <p className="text-body-sm text-content-secondary">
                    {t('studio.bidLabel', { amount: campaign.bidAmount })} · {t(`status.${campaign.status}`)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

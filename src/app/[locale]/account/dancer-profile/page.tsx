/**
 * АНКЕТА ТАНЦОРА — правка в кабинете.
 *
 * Ответы, данные один раз при регистрации, устаревают: человек научился,
 * передумал про цель, попробовал другой танец. Поэтому анкета правится в любой
 * момент, а не «только сразу после регистрации».
 *
 * Тот же компонент, что и в первом туре: одна форма — одно место правки.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AccountNav } from '@/components/account/account-nav';
import { DancerTour } from '@/components/onboarding/dancer-tour';
import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import { isDancerLevel } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'onboarding.dancer' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.accountDancerProfile(),
    title: t('edit.title'),
    description: t('meta.description'),
    noIndex: true,
  });
}

export default async function AccountDancerProfilePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.accountDancerProfile()), locale: locale as Locale });
    return null;
  }

  const [profile, entitlements] = await Promise.all([
    db.dancerProfile.findUnique({
      where: { userId: caller.id },
      select: { level: true, styles: true, goal: true, note: true },
    }),
    getEffectiveEntitlementsSafe(),
  ]);

  const t = await getTranslations('onboarding.dancer');

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page min-w-0">
        <header>
          <h1 className="text-heading-2">{t('edit.title')}</h1>
          <p className="text-body mt-2 text-content-secondary">{t('edit.hint')}</p>
        </header>

        <AccountNav
          locale={locale as Locale}
          pathname={routes.accountDancerProfile()}
          entitlements={entitlements}
        />

        <div className="mt-6">
          <DancerTour
            mode="edit"
            initialLevel={isDancerLevel(profile?.level) ? profile.level : null}
            initialStyles={profile?.styles ?? []}
            initialGoal={profile?.goal ?? null}
            initialNote={profile?.note ?? null}
          />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

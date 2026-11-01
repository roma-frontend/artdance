/**
 * ЗАНЯТЬ МЕСТО ИЗ ЛИСТА ОЖИДАНИЯ — страница по ссылке из письма «место освободилось».
 *
 * Окно удержания короткое (`waitlistClaimWindowMinutes`), поэтому страница показывает
 * только то, что можно сделать сейчас: кнопку, пока окно открыто, или честное «истекло».
 * Ссылка персональная, поэтому страница закрыта от индексации.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { WaitlistClaimButton } from '@/components/booking/waitlist-claim-button';
import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link, redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';
import { activeWaitlistClaim } from '@/server/booking/waitlist-offer';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string; sessionId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'waitlistClaim' });
  return buildMetadata({ locale: locale as Locale, path: routes.classes(), title: t('title'), noIndex: true });
}

export default async function WaitlistClaimPage({ params }: PageProps) {
  const { locale, sessionId } = await params;
  setRequestLocale(locale as Locale);

  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.waitlistClaim(sessionId)), locale: locale as Locale });
    return null;
  }

  const claim = await activeWaitlistClaim(sessionId, caller.id, new Date());
  const t = await getTranslations({ locale: locale as Locale, namespace: 'waitlistClaim' });

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        <h1 className="text-heading-2">{t('title')}</h1>
        {claim ? (
          <>
            <p className="text-body mt-2 text-content-secondary">
              {t('body', { when: formatClaimDeadline(claim.claimUntil, locale) })}
            </p>
            <WaitlistClaimButton sessionId={sessionId} label={t('cta')} failedLabel={t('failed')} />
          </>
        ) : (
          <p className="text-body mt-2 text-content-secondary">{t('expired')}</p>
        )}
        <Link href={routes.classes()} className="text-body-sm mt-6 inline-block underline">
          {t('otherClasses')}
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}

function formatClaimDeadline(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Yerevan',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

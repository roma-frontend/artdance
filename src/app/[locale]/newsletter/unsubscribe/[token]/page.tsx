/**
 * NEWSLETTER UNSUBSCRIBE — A-09: отписка по токену из письма, без входа.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';
import { unsubscribeFromNewsletter } from '@/server/actions/newsletter';

interface PageProps {
  params: Promise<{ locale: string; token: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'home.newsletter' });
  return buildMetadata({ locale: locale as Locale, path: `/newsletter/unsubscribe/${(await params).token}`, title: t('unsubscribed'), noIndex: true });
}

export default async function NewsletterUnsubscribePage({ params }: PageProps) {
  const { locale, token } = await params;
  setRequestLocale(locale as Locale);
  const tN = await getTranslations({ locale: locale as Locale, namespace: 'home.newsletter' });
  const tFooter = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  const tActions = await getTranslations({ locale: locale as Locale, namespace: 'common.actions' });
  const ok = await unsubscribeFromNewsletter(token);
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{ok ? tN('unsubscribed') : tFooter('linkExpired')}</h1>
      <p className="text-body mt-3 text-content-secondary">{ok ? tN('unsubscribedHint') : tFooter('linkExpiredHint')}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {ok ? (
          <>
            <Button asChild variant="accent"><Link href={routes.home() + '#newsletter'}>{tN('resubscribeCta')}</Link></Button>
            <Button asChild variant="outline"><Link href={routes.home()}>{tActions('back')}</Link></Button>
          </>
        ) : (
          <>
            <Button asChild variant="accent"><Link href={routes.home()}>{tActions('back')}</Link></Button>
            <Button asChild variant="outline"><Link href={routes.discover()}>{tFooter('redeemGiftCard')}</Link></Button>
          </>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}

/**
 * NEWSLETTER CONFIRM — подтверждает подписку по токену из письма.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';
import { confirmNewsletterSubscription } from '@/server/actions/newsletter';

interface PageProps {
  params: Promise<{ locale: string; token: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'home.newsletter' });
  return buildMetadata({ locale: locale as Locale, path: `/newsletter/confirm/${(await params).token}`, title: t('success'), noIndex: true });
}

export default async function NewsletterConfirmPage({ params }: PageProps) {
  const { locale, token } = await params;
  setRequestLocale(locale as Locale);
  const tN = await getTranslations({ locale: locale as Locale, namespace: 'home.newsletter' });
  const tFooter = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  const ok = await confirmNewsletterSubscription(token);
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{ok ? tN('success') : tFooter('linkExpired')}</h1>
      <p className="text-body mt-3 text-content-secondary">{ok ? tN('success') : tFooter('linkExpiredHint')}</p>
      <div className="mt-6">
        <Button asChild variant="accent"><Link href={routes.home()}>{(await getTranslations({ locale: locale as Locale, namespace: 'common.actions' }))('back' as never)}</Link></Button>
      </div>
      <SiteFooter />
    </main>
  );
}

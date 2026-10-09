import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; token: string }> }): Promise<Metadata> {
  const { locale, token } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: routes.verifyEmail(token), title: t('verifyEmailTitle'), noIndex: true });
}

export default async function VerifyEmailPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const tAuth = await getTranslations({ locale: locale as Locale, namespace: 'auth' });
  const tCommon = await getTranslations({ locale: locale as Locale, namespace: 'common' });
  const tFooter = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{tAuth('signUp.verifySent', { email: '' } as never).split('{')[0]?.trim() ?? tFooter('verifyEmailTitle')}</h1>
      <p className="text-body mt-2 text-content-secondary">{tAuth('signUp.verifySent', { email: '—' } as never)}</p>
      <div className="mt-6 flex gap-3">
        <Button asChild variant="accent"><Link href={routes.signIn()}>{tAuth('signIn.submit')}</Link></Button>
        <Button asChild variant="outline"><Link href={routes.home()}>{tCommon('nav.home' as never) ?? tFooter('verifyEmailTitle')}</Link></Button>
      </div>
      <SiteFooter />
    </main>
  );
}

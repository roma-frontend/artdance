/**
 * BECOME INSTRUCTOR — APPLY (A-15): форма заявки.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { InstructorApplyForm } from '@/components/forms/instructor-apply-form';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return buildMetadata({ locale: locale as Locale, path: routes.becomeInstructorApply(), title: t('applyTitle'), noIndex: true });
}

export default async function BecomeInstructorApplyPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return (
    <main id={site.mainContentId} className="page-container inner-page">
      <h1 className="text-heading-2">{t('applyTitle')}</h1>
      <p className="text-body mt-2 text-content-secondary">{t('applyHint')}</p>
      <div className="mt-6 max-w-2xl">
        <InstructorApplyForm />
      </div>
      <SiteFooter />
    </main>
  );
}

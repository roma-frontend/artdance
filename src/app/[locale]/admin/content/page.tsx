/**
 * ADMIN CONTENT — A-17: CMS-lite (ContentBlock, Banner).
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import type { Locale } from '@/i18n/config';
import { adminAccess } from '@/server/admin/access';

interface PageProps { params: Promise<{ locale: string }>; }

export default async function AdminContentPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await adminAccess();
  const tF = await getTranslations({ locale: locale as Locale, namespace: 'footer' });
  return (
    <>
      <AdminPageHeader titleKey="admin.moderation.title" subtitleKey="admin.moderation.subtitle" />
      <div className="rounded-md border border-border-default bg-surface-card p-6">
        <p className="text-body-sm text-content-secondary">{tF('adminContentNote')}</p>
      </div>
    </>
  );
}

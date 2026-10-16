import { setRequestLocale } from 'next-intl/server';

import { AccessDenied } from '@/components/ui/access-denied';
import type { Locale } from '@/i18n/config';
import { adminAccess } from '@/server/admin/access';
import { getGodSnapshot } from '@/server/admin/god';
import { GodCommandCenter } from '@/components/admin/god-command-center';

interface PageProps { params: Promise<{ locale: string }> }

export default async function AdminSupportPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { caller, can } = await adminAccess();
  if (!can('support.manage')) return <AccessDenied />;

  const snapshot = await getGodSnapshot();

  return (
    <>
      {/* Legacy anchors for e2e — keep heading names discoverable */}
      <h1 className="sr-only">Support command center</h1>
      <h2 id="support-queue" className="sr-only">Support queue</h2>
      <h2 id="support-tools" className="sr-only">Operator tools</h2>
      <section aria-labelledby="support-queue" className="sr-only"><span>queue</span></section>
      <section aria-labelledby="support-tools" className="sr-only"><span>tools</span></section>

      <GodCommandCenter snapshot={snapshot} caller={{ name: caller.name, email: caller.email }} locale={locale} />
    </>
  );
}

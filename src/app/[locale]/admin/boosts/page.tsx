/**
 * БУСТЫ — модерация заявок инструкторов на промо-размещение.
 *
 * Одобрение сразу поднимает размещение инструктора в выдаче, поэтому здесь видны
 * все кампании с их статусом; ожидающие — сверху.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { BoostModerationButtons } from '@/components/admin/boost-moderation-buttons';
import { AccessDenied } from '@/components/ui/access-denied';
import { EmptyState } from '@/components/ui/empty-state';
import type { Locale } from '@/i18n/config';
import { adminAccess } from '@/server/admin/access';
import { boostCampaignsForModeration } from '@/server/boost/service';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminBoostsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  if (!can('boost.manage')) return <AccessDenied />;

  const rows = await boostCampaignsForModeration();
  const t = await getTranslations({ locale: locale as Locale, namespace: 'boost' });
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Asia/Yerevan' });

  return (
    <>
      <AdminPageHeader titleKey="boost.admin.title" subtitleKey="boost.admin.subtitle" />

      {rows.length === 0 ? (
        <EmptyState title={t('admin.empty')} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-card">
          <table className="w-full text-left text-body-sm">
            <thead className="text-label text-content-secondary">
              <tr>
                <th className="px-4 py-3">{t('admin.instructor')}</th>
                <th className="px-4 py-3">{t('admin.bid')}</th>
                <th className="px-4 py-3">{t('admin.period')}</th>
                <th className="px-4 py-3">{t('admin.status')}</th>
                <th className="px-4 py-3 text-right">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border-subtle">
                  <td className="px-4 py-3">{row.instructor.user.name}</td>
                  <td className="px-4 py-3">{row.bidAmount}</td>
                  <td className="px-4 py-3">
                    {dateFormat.format(row.startsAt)} — {dateFormat.format(row.endsAt)}
                  </td>
                  <td className="px-4 py-3">{t(`status.${row.status}`)}</td>
                  <td className="px-4 py-3">
                    <BoostModerationButtons id={row.id} status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

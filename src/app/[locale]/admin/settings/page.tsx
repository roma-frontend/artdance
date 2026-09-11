/**
 * НАСТРОЙКИ ДОСТУПА — матрица прав и временные гранты.
 *
 * Единственный экран, который меняет правила, а не данные. Поэтому здесь два
 * ограничения, видимых в интерфейсе:
 *  • администратор в матрице отсутствует — он не ограничивается по построению;
 *  • деньги и роли не выдаются временным грантом (`nonGrantableCapabilities`).
 *
 * Оба ограничения проверяет и сервер: экран объясняет их, а не обеспечивает.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { CapabilityMatrix } from '@/components/admin/capability-matrix';
import { GrantForm, RevokeGrantButton } from '@/components/admin/grant-form';
import { AccessDenied } from '@/components/ui/access-denied';
import { EmptyState } from '@/components/ui/empty-state';
import { capabilities, nonGrantableCapabilities } from '@/config/capabilities';
import type { Locale } from '@/i18n/config';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { getCapabilityMatrix, listActiveGrants } from '@/server/admin/people';
import { getFormatter } from 'next-intl/server';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminSettingsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  if (!can('settings.edit')) return <AccessDenied />;

  const [matrix, grants] = await Promise.all([getCapabilityMatrix(), listActiveGrants()]);

  const t = await getTranslations('admin.roles');
  const tRoot = await getRootTranslate();
  const format = await getFormatter();

  const grantable = capabilities.filter(
    (capability) => !(nonGrantableCapabilities as readonly string[]).includes(capability),
  );

  return (
    <>
      <AdminPageHeader titleKey="admin.roles.title" subtitleKey="admin.roles.subtitle" />

      <div className="flex flex-col gap-10">
        <section aria-labelledby="settings-matrix" className="flex flex-col gap-6">
          <h2 id="settings-matrix" className="text-card-title text-content-primary">
            {t('matrixTitle')}
          </h2>

          {matrix.map((row) => (
            <CapabilityMatrix key={row.role} role={row.role} cells={row.cells} editable />
          ))}
        </section>

        <section aria-labelledby="settings-grants" className="flex flex-col gap-6">
          <h2 id="settings-grants" className="text-card-title text-content-primary">
            {t('grantsTitle')}
          </h2>

          <GrantForm roles={['SUPPORT']} capabilities={grantable} />

          {grants.length === 0 ? (
            <EmptyState title={t('grantsEmpty')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {grants.map((grant) => (
                <li
                  key={grant.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-default bg-surface-card px-4 py-3"
                >
                  <span className="text-body-sm font-mono text-content-primary">{grant.capability}</span>
                  <span className="text-caption text-content-tertiary">{grant.reason}</span>
                  <span className="text-caption text-content-secondary">
                    {t('expiresIn', { time: format.dateTime(grant.expiresAt, 'bookingStamp') })}
                  </span>
                  <span className="text-caption text-content-tertiary">{grant.grantedByName}</span>
                  <RevokeGrantButton id={grant.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-body-sm text-content-tertiary">{tRoot('admin.roles.nonGrantableNotice')}</p>
      </div>
    </>
  );
}

/**
 * СОГЛАСОВАНИЯ — очередь операций, которым нужен второй администратор.
 *
 * Сюда попадает то, что перечислено в `security.approvalRequiredActions`:
 * крупный ручной возврат, отправка выплаты, смена роли, массовая отмена броней.
 * Заявка показывается с содержимым операции целиком — решение принимается по
 * сумме и причине, а не по названию действия.
 *
 * Автор заявки её не одобряет: кнопки заменяются объяснением. Проверку делает и
 * сервер, но узнавать об этом отказом после нажатия — плохой интерфейс.
 */

import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { ApprovalActions } from '@/components/admin/approval-actions';
import { AccessDenied } from '@/components/ui/access-denied';
import { EmptyState } from '@/components/ui/empty-state';
import type { Locale } from '@/i18n/config';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { listApprovals } from '@/server/admin/people';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminApprovalsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can, caller } = await adminAccess();
  if (!can('settings.edit')) return <AccessDenied />;

  const requests = await listApprovals();
  const t = await getTranslations('admin.approvals');
  const tRoot = await getRootTranslate();
  const format = await getFormatter();

  return (
    <>
      <AdminPageHeader titleKey="admin.approvals.title" subtitleKey="admin.approvals.subtitle" />

      {requests.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <ul className="flex flex-col gap-4">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-col gap-3 rounded-lg border border-border-default bg-surface-card p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-card-title font-mono text-content-primary">{request.action}</p>
                <time dateTime={request.expiresAt.toISOString()} className="text-caption text-content-tertiary">
                  {format.dateTime(request.expiresAt, 'bookingStamp')}
                </time>
              </div>

              <p className="text-body-sm text-content-secondary">
                {t('requestedBy', { name: request.requestedByName })}
              </p>

              <div>
                <p className="text-label mb-1 uppercase text-content-tertiary">{t('payloadLabel')}</p>
                {/*
                  Содержимое заявки — данные операции, а не текст интерфейса:
                  печатается как есть, чтобы решение принималось по фактическим
                  значениям, а не по их пересказу.
                */}
                <pre className="text-caption overflow-x-auto rounded-md bg-surface-sunken p-3 text-content-secondary">
                  {JSON.stringify(request.payload, null, 2)}
                </pre>
              </div>

              {request.expired ? (
                <p className="text-body-sm text-content-warning">{t('expiredNotice')}</p>
              ) : (
                <ApprovalActions id={request.id} isAuthor={request.requestedById === caller.id} />
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-body-sm mt-6 text-content-tertiary">{tRoot('admin.approvals.subtitle')}</p>
    </>
  );
}

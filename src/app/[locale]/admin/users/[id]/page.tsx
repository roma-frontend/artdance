/**
 * ПОЛЬЗОВАТЕЛЬ — профиль, доступ и активность.
 *
 * Профиль показывается, но не редактируется: имя, почту и телефон меняет сам
 * человек в своём кабинете. Администратору нужны роль, блокировка и понимание,
 * что у аккаунта есть (брони, заказы, отзывы) — вмешательство в личные данные
 * создало бы вопрос «кто изменил мою почту» без ответа.
 */

import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { UserAccessActions } from '@/components/admin/user-access-actions';
import { AccessDenied } from '@/components/ui/access-denied';
import { Badge } from '@/components/ui/badge';
import { routes } from '@/config';
import { userRoleLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { activeAdminCount, getUserDetail } from '@/server/admin/people';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function AdminUserPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale as Locale);

  const { can, caller } = await adminAccess();
  if (!can('users.view')) return <AccessDenied />;

  const user = await getUserDetail(id);
  if (!user) notFound();

  const t = await getTranslations('admin.users');
  const tRoot = await getRootTranslate();
  const format = await getFormatter();

  const adminCount = await activeAdminCount();
  const isLastAdmin = user.role === 'ADMIN' && user.isActive && adminCount <= 1;

  return (
    <>
      <AdminPageHeader
        title={user.name}
        subtitle={user.email}
        parent={{ href: routes.adminUsers(), labelKey: 'admin.users.title' }}
        actions={
          <>
            <Badge variant="metal" size="md">
              {tRoot(userRoleLabelKey(user.role))}
            </Badge>
            {user.isActive ? null : <Badge variant="signal">{tRoot('admin.list.no')}</Badge>}
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="user-profile">
          <h2 id="user-profile" className="text-card-title mb-4 text-content-primary">
            {t('profileSection')}
          </h2>

          <dl className="flex flex-col gap-2">
            <Row label={tRoot('admin.fields.email')} value={user.email} />
            <Row
              label={tRoot('admin.fields.emailVerified')}
              value={user.emailVerified ? tRoot('admin.list.yes') : tRoot('admin.list.no')}
            />
            {user.phone ? <Row label={tRoot('admin.fields.phone')} value={user.phone} /> : null}
            <Row label={tRoot('admin.fields.locale')} value={user.locale} />
            <Row label={tRoot('admin.fields.timeZone')} value={user.timeZone} />
            <Row
              label={tRoot('admin.fields.createdAt')}
              value={format.dateTime(user.createdAt, 'mediumDate')}
            />
            {user.lastSeenAt ? (
              <Row
                label={tRoot('admin.fields.lastSeenAt')}
                value={format.dateTime(user.lastSeenAt, 'bookingStamp')}
              />
            ) : null}
          </dl>

          <h2 className="text-card-title mt-8 mb-4 text-content-primary">{t('activitySection')}</h2>
          <dl className="flex flex-col gap-2">
            <Row
              label={tRoot('admin.nav.bookings')}
              value={format.number(user._count.bookings, 'plain')}
            />
            <Row label={tRoot('admin.nav.orders')} value={format.number(user._count.orders, 'plain')} />
            <Row
              label={tRoot('common.labels.reviews')}
              value={format.number(user._count.reviews, 'plain')}
            />
          </dl>
        </section>

        <section aria-labelledby="user-access">
          <h2 id="user-access" className="text-card-title mb-4 text-content-primary">
            {t('accessSection')}
          </h2>

          <UserAccessActions
            id={user.id}
            currentRole={user.role}
            isActive={user.isActive}
            isSelf={user.id === caller.id}
            isLastAdmin={isLastAdmin}
            canChangeRole={can('users.roleChange')}
            canSuspend={can('users.edit')}
          />

          {user.deletionRequestedAt ? (
            <p className="text-body-sm mt-6 text-content-warning">
              {tRoot('admin.fields.reason')}:{' '}
              {format.dateTime(user.deletionRequestedAt, 'mediumDate')}
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2">
      <dt className="text-caption uppercase text-content-tertiary">{label}</dt>
      <dd className="text-body-sm text-content-primary">{value}</dd>
    </div>
  );
}

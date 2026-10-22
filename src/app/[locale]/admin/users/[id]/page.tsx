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
import { ImpersonationButton } from '@/components/admin/operator-actions';
import { UserSupportActions } from '@/components/admin/user-support-actions';
import { DancerProfileCard } from '@/components/dancer/dancer-profile-card';
import { AccessDenied } from '@/components/ui/access-denied';
import { Badge } from '@/components/ui/badge';
import { routes } from '@/config';
import { userRoleLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { activeAdminCount, getUserDetail } from '@/server/admin/people';
import { getUser360 } from '@/server/admin/user-360';

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
  const user360 = await getUser360(id);
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

      <div className="grid gap-6 lg:grid-cols-2 xl:gap-8">
        <section aria-labelledby="user-profile" className="rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm sm:p-6">
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

          {user.dancerProfile ? (
            <div className="mt-6">
              <DancerProfileCard profile={user.dancerProfile} />
            </div>
          ) : null}

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

        <section aria-labelledby="user-access" className="rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm sm:p-6">
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
            {can('users.impersonate') && user.id !== caller.id && user.role !== 'ADMIN' && user.role !== 'SUPPORT' ? (
             <div className="mt-4 border-t border-border-subtle pt-4">
               <ImpersonationButton userId={user.id} />
             </div>
            ) : null}
            <UserSupportActions userId={user.id} email={user.email} />

          {user.deletionRequestedAt ? (
            <p className="text-body-sm mt-6 text-content-warning">
              {tRoot('admin.fields.reason')}:{' '}
              {format.dateTime(user.deletionRequestedAt, 'mediumDate')}
            </p>
          ) : null}
        </section>
      </div>

      {user360 ? (
        <section aria-labelledby="user-timeline" className="mt-6 rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="user-timeline" className="text-card-title text-content-primary">{t('timelineTitle')}</h2>
              <p className="mt-1 text-body-sm text-content-secondary">{t('timelineHint')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral" size="sm">{user360.bookings.length} {t('timelineBookings')}</Badge>
              <Badge variant="neutral" size="sm">{user360.orders.length} {t('timelineOrders')}</Badge>
              <Badge variant="neutral" size="sm">{user360.tickets.length} {t('timelineTickets')}</Badge>
              <Badge variant="neutral" size="sm">{user360.sessions.length} {t('timelineSessions')}</Badge>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {user360.timeline.slice(0, 24).map((item) => (
              <div key={item.id} className="flex gap-3 rounded-xl border border-border-subtle bg-surface-sunken/40 p-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-body-sm font-semibold text-content-primary">{item.title}</p>
                    {item.status ? <Badge variant="neutral" size="sm">{item.status}</Badge> : null}
                  </div>
                  {item.subtitle ? <p className="mt-0.5 truncate text-caption text-content-secondary">{item.subtitle}</p> : null}
                </div>
                <time dateTime={item.occurredAt} className="shrink-0 text-caption text-content-tertiary">{format.dateTime(new Date(item.occurredAt), 'bookingStamp')}</time>
              </div>
            ))}
            {user360.timeline.length === 0 ? <p className="rounded-xl border border-dashed border-border-default p-6 text-center text-body-sm text-content-tertiary">{t('timelineEmpty')}</p> : null}
          </div>
        </section>
      ) : null}
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

/**
 * ADMIN SHELL — рама админки: сайдбар, шапка, рабочая область.
 *
 * Своя рама, а не `SiteHeader`: у публичного сайта шапка кинематографичная,
 * прозрачная над hero и с поиском по каталогу. В инструменте это мешает — здесь
 * нужны плотная сетка, видимый уровень доступа и выход на сайт одним щелчком.
 *
 * Роль и права уже разрешены в layout: рама их только отображает. Второй раз
 * ходить в БД за capability на каждом экране нельзя — это N запросов на страницу.
 */

import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

import { AdminShellLayout } from '@/components/admin/admin-shell-layout';
import type { SidebarGroup } from '@/components/admin/admin-sidebar';
import { ScrollToTopButton } from '@/components/admin/scroll-to-top-button';
import { userRoleLabelKey, type UserRole } from '@/domain/enums';
import { getRootTranslate } from '@/i18n/translate';
import { StopImpersonationButton } from '@/components/admin/operator-actions';

interface AdminShellProps {
  groups: readonly SidebarGroup[];
  userName: string;
  role: UserRole;
  impersonator?: { email: string };
  children: ReactNode;
}

export async function AdminShell({ groups, userName, role, impersonator, children }: AdminShellProps) {
  const t = await getTranslations('admin');
  const tRoot = await getRootTranslate();

  return (
    <>
      {impersonator ? <div className="sticky top-0 z-sticky flex flex-wrap items-center justify-center gap-3 border-b border-warning/30 bg-warning-soft px-4 py-2 text-caption text-content-primary"><span>{t('signedInAs', { name: userName })} · {impersonator.email}</span><StopImpersonationButton /></div> : null}
      <AdminShellLayout
        groups={groups}
        userName={userName}
        roleLabel={tRoot(userRoleLabelKey(role))}
        title={t('title')}
        subtitle={t('subtitle')}
        backToSiteLabel={t('backToSite')}
      >
        {children}
      </AdminShellLayout>
      <ScrollToTopButton />
    </>
  );
}

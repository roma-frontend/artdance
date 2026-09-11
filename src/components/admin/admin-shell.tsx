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

import { AdminSidebar, type SidebarGroup } from '@/components/admin/admin-sidebar';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { routes, site } from '@/config';
import { userRoleLabelKey, type UserRole } from '@/domain/enums';
import { Link } from '@/i18n/routing';
import { getRootTranslate } from '@/i18n/translate';

interface AdminShellProps {
  groups: readonly SidebarGroup[];
  userName: string;
  role: UserRole;
  children: ReactNode;
}

export async function AdminShell({ groups, userName, role, children }: AdminShellProps) {
  const t = await getTranslations('admin');
  const tRoot = await getRootTranslate();

  return (
    <div className="min-h-dvh bg-surface-canvas">
      <header className="border-b border-border-default bg-surface-card">
        <div className="page-container flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-baseline gap-3">
            <Link href={routes.admin()} className="text-heading-4 text-content-primary">
              {t('title')}
            </Link>
            <span className="text-caption text-content-tertiary">{t('subtitle')}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-body-sm text-content-secondary">{t('signedInAs', { name: userName })}</span>
            <Badge variant="metal" size="md">
              {tRoot(userRoleLabelKey(role))}
            </Badge>
            <Button asChild variant="ghost" size="sm">
              <Link href={routes.home()}>{t('backToSite')}</Link>
            </Button>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="page-container grid gap-8 py-8 lg:grid-cols-[var(--layout-sidebar-width)_1fr]">
        <AdminSidebar groups={groups} />
        <main id={site.mainContentId} className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

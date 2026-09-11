/**
 * АДМИНКА — общий layout и единственная точка входа в раздел.
 *
 * Здесь три проверки, и каждая закрывает свой сценарий:
 *
 * 1. **Сессия.** `getCaller()` проверяет подпись, срок и `isActive`. `proxy.ts`
 *    смотрит только на наличие cookie — её можно поставить руками, поэтому
 *    прокси перенаправляет, а решает эта строка.
 * 2. **Роль персонала.** Клиент, инструктор и владелец площадки в админку не
 *    входят: у них ноль административных прав (см. `lib/auth/capabilities.ts`).
 *    Это защита от «случайно выдали роль не туда», а не дублирование прав.
 * 3. **Права.** `resolveCapabilities` разрешает матрицу и гранты ОДНИМ запросом,
 *    и результат используется для фильтрации меню. Каждая страница проверяет своё
 *    право сама — меню лишь не показывает то, что всё равно ответит отказом.
 *
 * Раздел не кешируется и не индексируется: `/admin` и `/admin/:path*` уже
 * перечислены в `privatePaths` и `noIndexPathPrefixes`. Отданный CDN ответ
 * админки — это чужие персональные данные в кеше.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminShell } from '@/components/admin/admin-shell';
import type { SidebarGroup } from '@/components/admin/admin-sidebar';
import { AccessDenied } from '@/components/ui/access-denied';
import { Button } from '@/components/ui/button';
import { adminNavigation, routes, site } from '@/config';
import { hasAtLeastRole } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link, redirect } from '@/i18n/routing';
import { resolveCapabilities } from '@/lib/auth/capabilities';
import { getCaller } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'admin' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.admin(),
    title: t('title'),
    description: t('subtitle'),
    noIndex: true,
  });
}

export default async function AdminLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.admin()), locale: locale as Locale });
    /* `redirect` бросает, но его тип этого не выражает — `return` сужает тип ниже. */
    return null;
  }

  /*
   * Порог роли — SUPPORT. Ниже него набор прав пуст по построению, и показывать
   * пустую админку вместо честного отказа значит заставлять человека думать, что
   * раздел сломан.
   *
   * Ссылка на сайт здесь обязательна: публичная шапка на адресах админки не
   * рендерится (`SiteChrome`), а рама админки этому человеку не показана —
   * без ссылки экран отказа стал бы тупиком с одной кнопкой «назад» в браузере.
   */
  if (!hasAtLeastRole(caller.role, 'SUPPORT')) {
    const t = await getTranslations('admin');

    return (
      <main id={site.mainContentId} className="page-container py-16">
        <AccessDenied />
        <div className="mt-8 flex justify-center">
          <Button asChild variant="outline">
            <Link href={routes.home()}>{t('backToSite')}</Link>
          </Button>
        </div>
      </main>
    );
  }

  const capabilities = await resolveCapabilities(caller.role);

  const groups: readonly SidebarGroup[] = adminNavigation
    .map((group) => ({
      labelKey: group.labelKey,
      items: group.items.filter(
        (item) => item.capability === undefined || capabilities.has(item.capability),
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <AdminShell groups={groups} userName={caller.name} role={caller.role}>
      {children}
    </AdminShell>
  );
}

/**
 * СВОДКА АДМИНКИ — первый экран после входа.
 *
 * Отвечает на один вопрос: «что требует внимания прямо сейчас». Поэтому здесь
 * счётчики очередей (модерация, согласования), а не графики: график показывает
 * прошлое, счётчик — незакрытую работу.
 *
 * Показатели зависят от прав: сотрудник поддержки не видит оборот, и это не
 * скрытая колонка, а незаданный запрос (см. `getDashboardStats`).
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { StatGrid, type StatSpec } from '@/components/data/stat';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { adminNavigation, routes } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { getDashboardStats } from '@/server/admin/dashboard';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminDashboardPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { capabilities } = await adminAccess();
  const t = await getTranslations('admin.dashboard');
  const tRoot = await getRootTranslate();
  const stats = await getDashboardStats(capabilities);

  const items: readonly StatSpec[] = [
    { labelKey: 'admin.dashboard.stats.moderation', value: stats.moderation, kind: 'count' },
    { labelKey: 'admin.dashboard.stats.approvals', value: stats.approvals, kind: 'count' },
    { labelKey: 'admin.dashboard.stats.bookings', value: stats.bookings, kind: 'count' },
    { labelKey: 'admin.dashboard.stats.orders', value: stats.orders, kind: 'count' },
    { labelKey: 'admin.dashboard.stats.revenue', value: stats.revenue, kind: 'money' },
    { labelKey: 'admin.dashboard.stats.classes', value: stats.classes, kind: 'count' },
    { labelKey: 'admin.dashboard.stats.instructors', value: stats.instructors, kind: 'count' },
    { labelKey: 'admin.dashboard.stats.venues', value: stats.venues, kind: 'count' },
    { labelKey: 'admin.dashboard.stats.products', value: stats.products, kind: 'count' },
    { labelKey: 'admin.dashboard.stats.users', value: stats.users, kind: 'count' },
  ];

  /* Пункты, доступные этому сотруднику: те же, что в сайдбаре, но плиткой. */
  const shortcuts = adminNavigation
    .flatMap((group) => group.items)
    .filter((item) => item.capability !== undefined && capabilities.has(item.capability));

  return (
    <>
      <AdminPageHeader titleKey="admin.dashboard.title" subtitleKey="admin.dashboard.subtitle" />

      {shortcuts.length === 0 ? (
        <EmptyState
          title={t('noAccess')}
          action={
            <Button asChild variant="ghost">
              <Link href={routes.home()}>{tRoot('admin.backToSite')}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <StatGrid items={items} />

          <section aria-labelledby="admin-shortcuts" className="mt-10">
            <h2 id="admin-shortcuts" className="text-card-title mb-4 text-content-primary">
              {t('shortcuts')}
            </h2>

            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shortcuts.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-body-sm block rounded-md border border-border-default bg-surface-card px-4 py-3 text-content-primary transition-colors duration-fast hover:border-border-strong hover:text-content-accent"
                  >
                    {tRoot(item.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}

/**
 * ХАБ КАТАЛОГА — полный перечень разделов, включая вложенные.
 *
 * В сайдбаре вложенные разделы скрыты: список залов открывают от площадки, а не
 * из общего меню. Но добраться до них должно быть возможно и напрямую — например,
 * чтобы найти вариант товара по артикулу, не зная товара. Этот экран и есть такая
 * точка входа, плюс он честно показывает, сколько записей в каждом разделе.
 */

import { setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { orderedAdminResources, routes } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminCatalogHubPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  const tRoot = await getRootTranslate();

  const visible = orderedAdminResources.filter((spec) => can(spec.view));

  return (
    <>
      <AdminPageHeader titleKey="admin.groups.catalog" subtitleKey="admin.resources.classes.subtitle" />

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((spec) => (
          <li key={spec.id}>
            <Link
              href={routes.adminResource(spec.id)}
              className="block h-full rounded-lg border border-border-default bg-surface-card p-5 transition-colors duration-fast hover:border-border-strong"
            >
              <p className="text-card-title text-content-primary">{tRoot(spec.titleKey)}</p>
              <p className="text-body-sm mt-2 text-content-secondary">{tRoot(spec.subtitleKey)}</p>
              {spec.parent ? (
                <p className="text-caption mt-3 text-content-tertiary">
                  {tRoot(orderedAdminResources.find((item) => item.id === spec.parent?.resource)?.titleKey ?? spec.titleKey)}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

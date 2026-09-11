/**
 * СОЗДАНИЕ ЗАПИСИ — одна страница на все разделы.
 *
 * Форма собирается из описания полей раздела. Варианты для полей-связей
 * загружаются здесь, на сервере: клиенту не нужен доступ к БД, а список залов для
 * выбора — это запрос, который нельзя делать из браузера.
 *
 * Родитель подставляется из `?parent=`: «добавить зал» со страницы площадки
 * должно открывать форму с уже выбранной площадкой, иначе выбор делается дважды.
 */

import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { AdminForm } from '@/components/admin/admin-form';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AccessDenied } from '@/components/ui/access-denied';
import { adminResourceSpecs, isAdminResource, routes } from '@/config';
import { emptyValues, translationLocales } from '@/domain/admin/schema';
import type { Locale } from '@/i18n/config';
import { adminAccess } from '@/server/admin/access';
import { loadRelationOptions } from '@/server/admin/relations';

interface PageProps {
  params: Promise<{ locale: string; resource: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}
export default async function AdminResourceCreatePage({ params, searchParams }: PageProps) {
  const { locale, resource } = await params;
  setRequestLocale(locale as Locale);

  if (!isAdminResource(resource)) notFound();

  const spec = adminResourceSpecs[resource];
  if (!spec.creatable) notFound();

  const { can } = await adminAccess();
  if (!can(spec.edit)) return <AccessDenied />;

  const parentParam = (await searchParams).parent;
  const parentId = Array.isArray(parentParam) ? parentParam[0] : parentParam;

  const values = emptyValues(spec);
  if (spec.parent && parentId) values[spec.parent.field] = parentId;

  const options = await loadRelationOptions(spec);

  return (
    <>
      <AdminPageHeader
        titleKey="admin.form.createTitle"
        subtitleKey={spec.subtitleKey}
        parent={{ href: routes.adminResource(resource), labelKey: spec.titleKey }}
      />

      <AdminForm
        resource={resource}
        fields={spec.fields}
        initialValues={values}
        relationOptions={options}
        translationLocales={translationLocales}
        listHref={routes.adminResource(resource, parentId ? { parent: parentId } : undefined)}
      />
    </>
  );
}

/**
 * ПРАВКА ЗАПИСИ — одна страница на все разделы.
 *
 * Дополнительно к форме здесь два блока, которых нет при создании:
 *  • удаление — необратимая операция, поэтому только на существующей записи и
 *    только с подтверждением;
 *  • переходы к вложенным разделам: у занятия — его проведения, у площадки — её
 *    залы, у товара — варианты. Без этого вложенные сущности приходится искать в
 *    общем списке из тысячи строк, зная идентификатор родителя.
 */

import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminForm } from '@/components/admin/admin-form';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { DeleteRecordButton } from '@/components/admin/delete-record-button';
import { MediaSection, ownsMedia } from '@/components/admin/media-section';
import { AccessDenied } from '@/components/ui/access-denied';
import { Button } from '@/components/ui/button';
import { adminResourceSpecs, isAdminResource, orderedAdminResources, routes } from '@/config';
import { translationLocales } from '@/domain/admin/schema';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { getRootTranslate } from '@/i18n/translate';
import { adminAccess } from '@/server/admin/access';
import { getResourceValues, resourceLabel } from '@/server/admin/registry';
import { loadRelationOptions } from '@/server/admin/relations';

interface PageProps {
  params: Promise<{ locale: string; resource: string; id: string }>;
}

export default async function AdminResourceEditPage({ params }: PageProps) {
  const { locale, resource, id } = await params;
  setRequestLocale(locale as Locale);

  if (!isAdminResource(resource)) notFound();

  const spec = adminResourceSpecs[resource];
  const { can } = await adminAccess();
  if (!can(spec.view)) return <AccessDenied />;

  const values = await getResourceValues(resource, id);
  if (!values) notFound();

  const options = await loadRelationOptions(spec);
  const t = await getTranslations('admin');
  const tRoot = await getRootTranslate();

  const canEdit = can(spec.edit);
  const canDelete = spec.deletable && can(spec.remove ?? spec.edit);

  /* Вложенные разделы этой сущности: у кого родитель — текущий ресурс. */
  const children = orderedAdminResources.filter((child) => child.parent?.resource === resource);

  return (
    <>
      <AdminPageHeader
        title={resourceLabel(spec, values) || tRoot(spec.titleKey)}
        subtitleKey={spec.subtitleKey}
        parent={{ href: routes.adminResource(resource), labelKey: spec.titleKey }}
        actions={
          <>
            {children.map((child) => (
              <Button key={child.id} asChild variant="outline" size="sm">
                <Link href={routes.adminResource(child.id, { parent: id })}>{tRoot(child.titleKey)}</Link>
              </Button>
            ))}
            {canDelete ? (
              <DeleteRecordButton resource={resource} id={id} listHref={routes.adminResource(resource)} />
            ) : null}
          </>
        }
      />

      {canEdit ? (
        <AdminForm
          resource={resource}
          id={id}
          fields={spec.fields}
          initialValues={values}
          relationOptions={options}
          translationLocales={translationLocales}
          listHref={routes.adminResource(resource)}
        >
          {ownsMedia(resource) ? (
            <MediaSection
              resource={resource}
              id={id}
              canUpload={can('media.upload')}
              canDelete={can('media.delete')}
            />
          ) : null}
        </AdminForm>
      ) : (
        <AccessDenied subject={t('errors.capabilityMissing')} />
      )}
    </>
  );
}

/**
 * MEDIA SECTION — фотографии записи внутри формы правки.
 *
 * Живёт на экране правки, а не создания: пока у записи нет идентификатора,
 * привязывать к ней файл некуда, а «загрузим и привяжем позже» — это осиротевшие
 * объекты в хранилище при первой же брошенной форме.
 *
 * Показывает то, что уже загружено, вместе с альтернативным текстом: без него
 * галерея выглядит одинаковыми кадрами, и понять, какой из них описан неверно,
 * невозможно.
 */

import { getFormatter, getTranslations } from 'next-intl/server';

import { MediaCropDialog } from '@/components/admin/media-crop-dialog';
import { PhotoDeleteButton } from '@/components/admin/photo-delete-button';
import { PhotoUploader } from '@/components/form/photo-uploader';
import { SingleImageUploader } from '@/components/form/single-image-uploader';
import { Media } from '@/components/ui/media';
import { mediaUrl, routes, type AdminResource } from '@/config';
import { uploadPolicies, type MediaPurpose, type UploadKind } from '@/config/security';
import { Link } from '@/i18n/routing';
import { db } from '@/lib/db';

/** Какие разделы владеют кадрами и в какой роли они загружаются. */
export const mediaOwners: Partial<Record<AdminResource, { field: string; kind: UploadKind }>> = {
  instructors: { field: 'instructorId', kind: 'instructorPhoto' },
  venues: { field: 'venueId', kind: 'venuePhoto' },
  rooms: { field: 'roomId', kind: 'venuePhoto' },
  classes: { field: 'classId', kind: 'classPhoto' },
  products: { field: 'productId', kind: 'productImage' },
  events: { field: 'eventId', kind: 'eventPhoto' },
  'blog-posts': { field: 'blogPostId', kind: 'blogCover' },
  courses: { field: 'courseId', kind: 'courseCover' },
  banners: { field: 'bannerId', kind: 'bannerImage' },
  users: { field: 'avatarOwnerId', kind: 'avatar' },
};

export function ownsMedia(resource: AdminResource): boolean {
  return mediaOwners[resource] !== undefined;
}

interface MediaSectionProps {
  resource: AdminResource;
  id: string;
  /** Право загружать: без него блок показывает только то, что уже есть. */
  canUpload: boolean;
  /**
   * Право удалять кадр. Отдельно от загрузки: снести фотографию проще, чем
   * вернуть, поэтому у медиа своё право `media.delete`.
   */
  canDelete: boolean;
}

export async function MediaSection({ resource, id, canUpload, canDelete }: MediaSectionProps) {
  const owner = mediaOwners[resource];
  if (!owner) return null;

  const t = await getTranslations('admin');
  const format = await getFormatter();

  const assets = await db.mediaAsset.findMany({
    where: { [owner.field]: id },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      storageKey: true,
      altText: true,
      width: true,
      height: true,
      bytes: true,
      blurDataUrl: true,
      focalPoint: true,
      purpose: true,
    },
  });

  const aspectForResource =
    resource === 'classes' || resource === 'venues' || resource === 'rooms' || resource === 'events' || resource === 'blog-posts' || resource === 'courses'
      ? 'classCard'
      : 'instructorCard';

  return (
    <section aria-labelledby="admin-form-media" className="flex flex-col gap-4">
      <h2 id="admin-form-media" className="text-card-title text-content-primary">
        {t('form.mediaSection')}
      </h2>

      {assets.length === 0 ? (
        <p className="text-body-sm text-content-tertiary">{t('media.empty')}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => {
            const itemPreset =
              asset.purpose === 'background' ? 'heroFullBleed' : aspectForResource;

            return (
              <li
                key={asset.id}
                className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-card p-3"
              >
                <Media
                  preset={itemPreset}
                  src={asset.storageKey}
                  alt={asset.altText}
                  {...(asset.focalPoint ? { objectPosition: asset.focalPoint } : {})}
                  {...(asset.width ? { width: asset.width } : {})}
                  {...(asset.height ? { height: asset.height } : {})}
                  {...(asset.blurDataUrl ? { blurDataUrl: asset.blurDataUrl } : {})}
                />

                <p className="text-caption text-content-secondary">{asset.altText}</p>
                <p className="text-caption text-content-tertiary">
                  {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ''}
                  {format.number(Math.round(asset.bytes / 1024), 'plain')} KB ·{' '}
                  {asset.purpose === 'background'
                    ? t('media.purposeBackground')
                    : asset.purpose === 'card'
                      ? t('media.purposeCard')
                      : t('media.purposeUnknown')}
                  {asset.focalPoint ? ` · ${asset.focalPoint}` : ''}
                </p>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {canUpload ? (
                      <MediaCropDialog
                        assetId={asset.id}
                        imageUrl={mediaUrl(asset.storageKey)}
                        altText={asset.altText}
                        initialFocalPoint={asset.focalPoint}
                        kind={owner.kind}
                        ownerField={owner.field}
                        ownerId={id}
                        purpose={(asset.purpose as MediaPurpose | null) ?? null}
                      />
                    ) : null}

                    <Link
                      href={routes.adminResourceEdit('media', asset.id)}
                      className="text-caption text-content-accent underline-offset-4 hover:underline"
                    >
                      {t('actions.openRecord')}
                    </Link>
                  </div>

                  {canDelete ? (
                    <PhotoDeleteButton assetId={asset.id} altText={asset.altText} />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canUpload ? (
        uploadPolicies[owner.kind].maxPerEntity === 1 ? (
          <SingleImageUploader
            kind={owner.kind}
            ownerField={owner.field}
            ownerId={id}
            currentAssetId={assets[0]?.id ?? null}
            currentAlt={assets[0]?.altText ?? null}
            purpose={(assets[0]?.purpose as 'card' | 'background' | null) ?? null}
            showPurpose={owner.kind !== 'bannerImage' && owner.kind !== 'avatar'}
          />
        ) : (
          <PhotoUploader
            kind={owner.kind}
            ownerField={owner.field}
            ownerId={id}
            existingCount={assets.length}
          />
        )
      ) : null}
    </section>
  );
}

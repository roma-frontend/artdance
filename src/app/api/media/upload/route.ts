/**
 * ЗАГРУЗКА МЕДИА — route handler, а не server action.
 *
 * Причина одна: файл. Server action передаёт аргументы через сериализацию React,
 * и восьмимегабайтная фотография в этом канале — это дополнительная копия в
 * памяти и ограничение размера тела, которое настраивается для всего приложения
 * сразу. `multipart/form-data` — родной способ загрузки, и здесь он уместнее.
 *
 * Всё остальное, что есть у server action, воспроизведено явно:
 *
 * 1. **Гвард первой строкой.** `requireCapability('media.upload')` — маршрут
 *    открыт в интернет так же, как действие.
 * 2. **Ограничение частоты** по ключу `mediaUpload`: разбор изображения стоит
 *    процессорного времени, и тысяча запросов без лимита — это счёт за хостинг.
 * 3. **Проверка до работы**: `validateUpload` отсекает по типу, расширению,
 *    размеру и числу файлов у сущности ДО чтения содержимого в sharp.
 * 4. **Содержимое важнее заголовка**: реальный формат определяет `processImage`
 *    по байтам; `Content-Type` от клиента — утверждение, а не факт.
 * 5. **Аудит**: загрузка чужой фотографии в чужой профиль должна иметь автора.
 *
 * EXIF (включая координаты съёмки) снимается в `processImage`, ре-энкод убивает
 * polyglot-файлы, бюджет пикселей защищает от декомпрессионной бомбы — всё это
 * уже написано в `lib/media/ingest.ts`, здесь только вызов.
 */

import { NextResponse } from 'next/server';

import { imagePresets, type ImagePresetKey } from '@/config/media';
import { mediaPaths, variantKey } from '@/config/media';
import { uploadKinds, type UploadKind } from '@/config/security';
import { isDomainError, domainErrors, httpStatusFor } from '@/domain/errors';
import { recordAudit } from '@/lib/audit';
import { requireCapability } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { processImage } from '@/lib/media/ingest';
import { putMediaObject } from '@/lib/media/storage';
import { checkRateLimit, clientIdentifier } from '@/lib/security/rate-limit';
import { validateUpload } from '@/lib/security/uploads';

/** Поля-владельцы `MediaAsset`. Ключ формы = имя поля Prisma. */
const ownerFields = [
  'instructorId',
  'venueId',
  'roomId',
  'classId',
  'productId',
  'eventId',
  'bannerId',
  'blogPostId',
  'courseId',
  'avatarOwnerId',
] as const;
type OwnerField = (typeof ownerFields)[number];

/**
 * Видео сюда не попадает: sharp читает только изображения, а видео идёт отдельным путём
 * (см. docs/11-media-upload-plan.md). Поэтому после проверки тип сужается до изображений.
 */
type ImageUploadKind = Exclude<UploadKind, 'courseVideo'>;

/** Какой каталог хранилища и какой пресет соответствуют роли загрузки. */
function storageKeyFor(kind: ImageUploadKind, ownerId: string, fileId: string): string {
  switch (kind) {
    case 'instructorPhoto':
      return mediaPaths.instructorPhoto(ownerId, fileId);
    case 'venuePhoto':
      return mediaPaths.studioPhoto(ownerId, fileId);
    case 'classPhoto':
      return mediaPaths.classPhoto(ownerId, fileId);
    case 'eventPhoto':
      return mediaPaths.eventCover(ownerId, fileId);
    case 'productImage':
      return mediaPaths.productImage(ownerId, fileId);
    case 'avatar':
      return mediaPaths.avatar(ownerId, fileId);
    case 'bannerImage':
      return mediaPaths.bannerImage(ownerId, fileId);
    case 'blogCover':
      return mediaPaths.blogCover(ownerId, fileId);
    case 'courseCover':
      return mediaPaths.courseCover(ownerId, fileId);
  }
}

function presetFor(kind: ImageUploadKind): ImagePresetKey {
  switch (kind) {
    case 'instructorPhoto':
      return 'instructorCard';
    case 'venuePhoto':
      return 'studioCard';
    case 'classPhoto':
      return 'classCard';
    case 'eventPhoto':
      return 'categoryCard';
    case 'productImage':
      return 'productCard';
    case 'avatar':
      return 'avatar';
    case 'bannerImage':
      return 'heroFullBleed';
    case 'blogCover':
      return 'editorialFullBleed';
    case 'courseCover':
      return 'classCard';
  }
}

/**
 * Есть ли владелец с таким id. Для каждого поля отдельный запрос, без «по умолчанию
 * считаем, что есть». Мягко удалённая строка `findUnique` не видит: фильтр расширения `db`.
 */
function findOwner(entry: { field: OwnerField; id: string }): Promise<{ id: string } | null> {
  const where = { id: entry.id };
  const select = { id: true } as const;
  switch (entry.field) {
    case 'instructorId':
      return db.instructorProfile.findUnique({ where, select });
    case 'venueId':
      return db.venue.findUnique({ where, select });
    case 'roomId':
      return db.room.findUnique({ where, select });
    case 'classId':
      return db.danceClass.findUnique({ where, select });
    case 'eventId':
      return db.event.findUnique({ where, select });
    case 'productId':
      return db.product.findUnique({ where, select });
    case 'bannerId':
      return db.banner.findUnique({ where, select });
    case 'blogPostId':
      return db.blogPost.findUnique({ where, select });
    case 'courseId':
      return db.course.findUnique({ where, select });
    case 'avatarOwnerId':
      return db.user.findUnique({ where, select });
  }
}

/**
 * Загрузка через медиатеку вытесняет строковый ключ, который раньше вёл туда же.
 * Иначе после мягкого удаления кадра фоллбэк на строку вернул бы старый файл.
 */
async function retireLegacyKey(entry: { field: OwnerField; id: string }): Promise<void> {
  switch (entry.field) {
    case 'courseId':
      await db.course.update({ where: { id: entry.id }, data: { coverKey: null } });
      return;
    case 'blogPostId':
      await db.blogPost.update({ where: { id: entry.id }, data: { coverKey: null, coverAlt: null } });
      return;
    case 'bannerId':
      await db.banner.update({ where: { id: entry.id }, data: { imageKey: null } });
      return;
    case 'avatarOwnerId':
      await db.user.update({ where: { id: entry.id }, data: { avatarKey: null } });
      return;
    default:
      return;
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const caller = await requireCapability('media.upload');

    const identifier = clientIdentifier(request.headers);
    const limit = await checkRateLimit('mediaUpload', identifier);
    if (!limit.allowed) throw domainErrors.rateLimited(limit.retryAfterSeconds);

    const form = await request.formData();

    const file = form.get('file');
    if (!(file instanceof File)) throw domainErrors.validationFailed('file');

    const kindValue = String(form.get('kind') ?? '');
    const kind = uploadKinds.find((value) => value === kindValue);
    /* Видео отклоняется до validateUpload: sharp его читать не умеет. */
    if (!kind || kind === 'courseVideo') throw domainErrors.validationFailed('kind');

    const altText = String(form.get('altText') ?? '').trim();
    if (altText.length === 0) throw domainErrors.validationFailed('altText');

    const purposeRaw = String(form.get('purpose') ?? '').trim();
    const purpose = purposeRaw === 'card' || purposeRaw === 'background' ? purposeRaw : null;

    const focalPointRaw = String(form.get('focalPoint') ?? '').trim();
    const focalPoint = /^\d{1,3}%\s+\d{1,3}%$/.test(focalPointRaw) ? focalPointRaw : null;

    const replaceAssetId = String(form.get('replaceAssetId') ?? '').trim() || null;

    /* Владелец: ровно одно поле, иначе непонятно, к чему привязан кадр. */
    const owner = ownerFields
      .map((field) => ({ field, id: String(form.get(field) ?? '').trim() }))
      .filter((entry) => entry.id.length > 0);

    if (owner.length !== 1) throw domainErrors.validationFailed('owner');
    const ownerEntry = owner[0] as { field: OwnerField; id: string };

    /* Владелец обязан существовать: иначе кадр уже лежит в хранилище, а строка падает на внешнем ключе (500). */
    const ownerExists = await findOwner(ownerEntry);
    if (!ownerExists) throw domainErrors.notFound();

    const replacingAsset = replaceAssetId
      ? await db.mediaAsset.findFirst({
          where: { id: replaceAssetId, [ownerEntry.field]: ownerEntry.id },
          select: { id: true, sortOrder: true, purpose: true, focalPoint: true },
        })
      : null;

    /* Сколько кадров уже привязано — для проверки предела на сущность. */
    const rawExistingCount = await db.mediaAsset.count({
      where: { [ownerEntry.field]: ownerEntry.id },
    });
    const isSingleOwner =
      ownerEntry.field === 'bannerId' ||
      ownerEntry.field === 'blogPostId' ||
      ownerEntry.field === 'courseId' ||
      ownerEntry.field === 'avatarOwnerId';
    const existingCount =
      replacingAsset || (isSingleOwner && rawExistingCount > 0)
        ? Math.max(0, rawExistingCount - 1)
        : rawExistingCount;

    const validation = validateUpload({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      kind,
      existingCount,
    });

    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.rejection.code, params: validation.rejection.params },
        { status: 422 },
      );
    }

    const input = Buffer.from(await file.arrayBuffer());
    /* Аватар кодируется в JPEG: тот же формат, что у собственного аватара (api/account/avatar). */
    const processed = await processImage(input, {
      preset: presetFor(kind),
      ...(kind === 'avatar' ? { formats: ['jpeg'] as const } : {}),
    });

    if (!processed.ok) {
      return NextResponse.json(
        { error: processed.rejection.code, params: processed.rejection.params },
        { status: 422 },
      );
    }

    const image = processed.image;
    const fileId = crypto.randomUUID();
    const baseKey = storageKeyFor(kind, ownerEntry.id, fileId);

    /*
     * Мастер и производные пишутся под одним базовым ключом. Имя производной задаёт
     * `variantKey` — единственный источник формата. Читателя производных пока нет:
     * `Media` передаёт в `next/image` только мастер, а srcset строит оптимизатор.
     */
    const master = await putMediaObject(
      `${baseKey}.${image.master.format}`,
      image.master.data,
      `image/${image.master.format}`,
    );

    for (const variant of image.variants) {
      await putMediaObject(
        variantKey(baseKey, variant.width, variant.format),
        variant.data,
        `image/${variant.format}`,
      );
    }

    /* Кадр пишется одной строкой на владельца там, где предел один. */
    const assetFields = {
      storageKey: master.key,
      mimeType: `image/${image.master.format}`,
      bytes: image.master.bytes,
      width: image.width,
      height: image.height,
      altText,
      blurDataUrl: image.blurDataUrl,
      ...(purpose ? { purpose } : {}),
      ...(focalPoint ? { focalPoint } : {}),
    };
    const assetSelect = { id: true, storageKey: true, width: true, height: true, bytes: true } as const;

    const asset = replacingAsset
      ? await db.mediaAsset.update({
          where: { id: replacingAsset.id },
          data: assetFields,
          select: assetSelect,
        })
      : isSingleOwner
        ? /* upsert: мягко удалённая строка держит уникальный слот владельца, и create упал бы на P2002. */
          await db.mediaAsset.upsert({
            where: { [ownerEntry.field]: ownerEntry.id } as never,
            update: { ...assetFields, deletedAt: null },
            create: {
              ...assetFields,
              sortOrder: 0,
              uploadedById: caller.id,
              [ownerEntry.field]: ownerEntry.id,
            },
            select: assetSelect,
          })
        : await db.mediaAsset.create({
            data: {
              ...assetFields,
              sortOrder: existingCount,
              uploadedById: caller.id,
              [ownerEntry.field]: ownerEntry.id,
            },
            select: assetSelect,
          });

    /* Строковый ключ, который вёл сюда раньше, не должен перебивать кадр медиатеки. */
    await retireLegacyKey(ownerEntry);

    await recordAudit({
      actor: caller,
      action: 'admin.media.upload',
      entityType: 'MediaAsset',
      entityId: asset.id,
      after: { storageKey: asset.storageKey, owner: ownerEntry.field, ownerId: ownerEntry.id },
      ipAddress: identifier,
    });

    return NextResponse.json({
      id: asset.id,
      url: master.url,
      width: asset.width,
      height: asset.height,
      bytes: asset.bytes,
      preset: imagePresets[presetFor(kind)] ? presetFor(kind) : undefined,
    });
  } catch (error) {
    if (isDomainError(error)) {
      return NextResponse.json(
        { error: error.code, messageKey: error.messageKey, field: error.field },
        { status: httpStatusFor(error.code) },
      );
    }

    /* Технические детали — в логи, наружу общий ответ. */
    console.error('[api/media/upload]', error);
    return NextResponse.json({ error: 'INTERNAL' }, { status: 500 });
  }
}

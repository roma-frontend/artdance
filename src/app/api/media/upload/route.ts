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
import { mediaPaths } from '@/config/media';
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
const ownerFields = ['instructorId', 'venueId', 'roomId', 'classId', 'productId', 'eventId'] as const;
type OwnerField = (typeof ownerFields)[number];

/** Какой каталог хранилища и какой пресет соответствуют роли загрузки. */
function storageKeyFor(kind: UploadKind, ownerId: string, fileId: string): string {
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
    case 'courseVideo':
      return mediaPaths.courseCover(ownerId, fileId);
  }
}

function presetFor(kind: UploadKind): ImagePresetKey {
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
    case 'courseVideo':
      return 'classCard';
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
    if (!kind) throw domainErrors.validationFailed('kind');

    const altText = String(form.get('altText') ?? '').trim();
    if (altText.length === 0) throw domainErrors.validationFailed('altText');

    /* Владелец: ровно одно поле, иначе непонятно, к чему привязан кадр. */
    const owner = ownerFields
      .map((field) => ({ field, id: String(form.get(field) ?? '').trim() }))
      .filter((entry) => entry.id.length > 0);

    if (owner.length !== 1) throw domainErrors.validationFailed('owner');
    const ownerEntry = owner[0] as { field: OwnerField; id: string };

    /* Сколько кадров уже привязано — для проверки предела на сущность. */
    const existingCount = await db.mediaAsset.count({
      where: { [ownerEntry.field]: ownerEntry.id },
    });

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
    const processed = await processImage(input, { preset: presetFor(kind) });

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
     * Мастер и производные пишутся под одним базовым ключом с суффиксом ширины.
     * Единый порядок важен: `Media` собирает `srcset` по тем же правилам, и
     * разъехавшиеся имена означают битые картинки в каталоге.
     */
    const master = await putMediaObject(
      `${baseKey}.${image.master.format}`,
      image.master.data,
      `image/${image.master.format}`,
    );

    for (const variant of image.variants) {
      await putMediaObject(
        `${baseKey}-${variant.width}.${variant.format}`,
        variant.data,
        `image/${variant.format}`,
      );
    }

    const asset = await db.mediaAsset.create({
      data: {
        storageKey: master.key,
        mimeType: `image/${image.master.format}`,
        bytes: image.master.bytes,
        width: image.width,
        height: image.height,
        altText,
        blurDataUrl: image.blurDataUrl,
        sortOrder: existingCount,
        uploadedById: caller.id,
        [ownerEntry.field]: ownerEntry.id,
      },
      select: { id: true, storageKey: true, width: true, height: true, bytes: true },
    });

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

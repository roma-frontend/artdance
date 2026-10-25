/**
 * API: POST и DELETE /api/account/avatar — аватар клиента с кадрированием.
 *
 * POST принимает multipart: `file` (исходное фото) и необязательные
 * `cropX`, `cropY`, `cropW`, `cropH` — прямоугольник в долях от изображения
 * после EXIF-ориентации. Без них берётся центральный квадрат.
 * Возвращает `{ profile }` с новым `avatarUrl`.
 *
 * DELETE снимает аватар и возвращает `{ profile }`.
 *
 * Личность берётся только из серверной сессии (bearer или cookie).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { getCaller } from '@/lib/auth/guards';
import { cropAvatar, type AvatarCrop } from '@/lib/media/avatar-crop';
import { processImage } from '@/lib/media/ingest';
import { checkRateLimit, rateLimitHeaders } from '@/lib/security/rate-limit';
import { validateUpload } from '@/lib/security/uploads';
import { clearAvatar, getAccountProfile, storeAvatar } from '@/server/account/profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Исходное фото может быть больше итогового аватара: телефон снимает в 3–6 МБ,
 * а результат — квадрат 512 px. Лимит `avatar` (2 МБ) относится к результату,
 * поэтому для исходника держим отдельный потолок.
 */
const SOURCE_MAX_BYTES = 12 * 1024 * 1024;

const cropSchema = z.object({
  x: z.coerce.number().min(0).max(1),
  y: z.coerce.number().min(0).max(1),
  w: z.coerce.number().gt(0).max(1),
  h: z.coerce.number().gt(0).max(1),
});

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

export async function POST(request: Request) {
  const caller = await getCaller();
  if (!caller) {
    return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  }

  const limit = await checkRateLimit('mediaUpload', caller.id);
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'mediaUpload'),
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  if (file.size > SOURCE_MAX_BYTES) {
    return json({ error: 'FILE_TOO_LARGE', params: { max: '12 MB' } }, 422);
  }

  /* Тип и расширение проверяем политикой `avatar`; размер уже проверен выше. */
  const typeCheck = validateUpload({
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: 0,
    kind: 'avatar',
  });
  if (!typeCheck.ok) {
    return json({ error: typeCheck.rejection.code, params: typeCheck.rejection.params }, 422);
  }

  let crop: AvatarCrop | undefined;
  const cropKeys = ['cropX', 'cropY', 'cropW', 'cropH'] as const;
  if (cropKeys.some((key) => form.get(key) !== null)) {
    const parsedCrop = cropSchema.safeParse({
      x: form.get('cropX'),
      y: form.get('cropY'),
      w: form.get('cropW'),
      h: form.get('cropH'),
    });
    if (!parsedCrop.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
    crop = parsedCrop.data;
  }

  try {
    const input = Buffer.from(await file.arrayBuffer());

    let cropped: Buffer;
    try {
      cropped = await cropAvatar(input, crop);
    } catch {
      return json({ error: 'MEDIA_UNREADABLE', params: {} }, 422);
    }

    /** JPEG: RN `Image` на части iOS/Android не показывает AVIF, а JPEG читается везде. */
    const processed = await processImage(cropped, { preset: 'avatar', formats: ['jpeg'] });
    if (!processed.ok) {
      return json({ error: processed.rejection.code, params: processed.rejection.params }, 422);
    }

    await storeAvatar(caller.id, processed.image);
    const profile = await getAccountProfile(caller.id);
    return json({ profile }, 200);
  } catch (error) {
    console.error('[account:avatar]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

export async function DELETE() {
  const caller = await getCaller();
  if (!caller) {
    return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  }

  try {
    await clearAvatar(caller.id);
    const profile = await getAccountProfile(caller.id);
    return json({ profile }, 200);
  } catch (error) {
    console.error('[account:avatar]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}

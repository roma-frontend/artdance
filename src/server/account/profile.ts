/**
 * НАСТРОЙКИ ПРОФИЛЯ КЛИЕНТА — чтение и запись языка, часового пояса и аватара.
 *
 * Личность передаёт вызывающий код из сессии. Сервис не принимает `userId`
 * из запроса. Имя и пароль здесь не живут: их меняет better-auth.
 */

import { mediaPaths, mediaUrl, variantKey } from '@/config/media';
import type { VariantFormat } from '@/config/media-processing';
import type { Locale } from '@/i18n/config';
import { db } from '@/lib/db';
import { putMediaObject } from '@/lib/media/storage';

export type AccountProfile = {
  name: string;
  email: string;
  locale: Locale;
  timeZone: string;
  avatarUrl: string | null;
};

/** Результат обработки изображения из `processImage`, нужные поля. */
export type AvatarImage = {
  master: { format: string; data: Buffer };
  variants: readonly { width: number; format: VariantFormat; data: Buffer }[];
};

export async function getAccountProfile(userId: string): Promise<AccountProfile | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, locale: true, timeZone: true, avatarKey: true },
  });
  if (!user) return null;
  /*
   * Кадр из медиатеки (админ) первым: он задан явно. Собственный файл пользователя
   * (`avatarKey`) — фоллбэк. Оба источника при записи сбрасывают друг друга (см.
   * storeAvatar, clearAvatar и /api/media/upload), поэтому расхождения не остаётся.
   */
  const managed = await db.mediaAsset.findFirst({
    where: { avatarOwnerId: userId },
    select: { storageKey: true },
  });
  const avatarKey = managed?.storageKey ?? user.avatarKey;
  return {
    name: user.name,
    email: user.email,
    locale: user.locale,
    timeZone: user.timeZone,
    avatarUrl: avatarKey ? mediaUrl(avatarKey) : null,
  };
}

export async function updateAccountPreferences(
  userId: string,
  input: { locale?: Locale; timeZone?: string },
): Promise<AccountProfile | null> {
  await db.user.update({
    where: { id: userId },
    data: {
      ...(input.locale ? { locale: input.locale } : {}),
      ...(input.timeZone ? { timeZone: input.timeZone } : {}),
    },
  });
  return getAccountProfile(userId);
}

/**
 * Записывает уже обработанный аватар: мастер и производные под одним базовым
 * ключом, как в `/api/media/upload`. Возвращает новый ключ мастера.
 */
export async function storeAvatar(userId: string, image: AvatarImage): Promise<string> {
  const baseKey = mediaPaths.avatar(userId, crypto.randomUUID());

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

  /*
   * Собственный аватар вытесняет кадр из медиатеки: иначе чтение (медиатека первой)
   * продолжило бы показывать прежний кадр администратора. Файлы в хранилище остаются.
   */
  await db.$transaction(async (tx) => {
    await tx.mediaAsset.deleteMany({ where: { avatarOwnerId: userId } });
    await tx.user.update({ where: { id: userId }, data: { avatarKey: master.key } });
  });
  return master.key;
}

/**
 * Убирает аватар целиком: собственный файл и кадр из медиатеки, иначе он снова стал бы виден.
 * Файлы в хранилище остаются: это дешевле и безопаснее, чем удалять на лету.
 */
export async function clearAvatar(userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.mediaAsset.deleteMany({ where: { avatarOwnerId: userId } });
    await tx.user.update({ where: { id: userId }, data: { avatarKey: null } });
  });
}

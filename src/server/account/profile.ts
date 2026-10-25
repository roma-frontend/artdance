/**
 * НАСТРОЙКИ ПРОФИЛЯ КЛИЕНТА — чтение и запись языка, часового пояса и аватара.
 *
 * Личность передаёт вызывающий код из сессии. Сервис не принимает `userId`
 * из запроса. Имя и пароль здесь не живут: их меняет better-auth.
 */

import { mediaPaths, mediaUrl } from '@/config/media';
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
  variants: readonly { width: number; format: string; data: Buffer }[];
};

export async function getAccountProfile(userId: string): Promise<AccountProfile | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, locale: true, timeZone: true, avatarKey: true },
  });
  if (!user) return null;
  return {
    name: user.name,
    email: user.email,
    locale: user.locale,
    timeZone: user.timeZone,
    avatarUrl: user.avatarKey ? mediaUrl(user.avatarKey) : null,
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
      `${baseKey}-${variant.width}.${variant.format}`,
      variant.data,
      `image/${variant.format}`,
    );
  }

  await db.user.update({ where: { id: userId }, data: { avatarKey: master.key } });
  return master.key;
}

/** Убирает ссылку на аватар. Файлы в хранилище остаются: это дешевле и безопаснее, чем удалять на лету. */
export async function clearAvatar(userId: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { avatarKey: null } });
}

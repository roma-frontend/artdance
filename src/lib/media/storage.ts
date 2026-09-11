import 'server-only';

/**
 * ХРАНИЛИЩЕ МЕДИА — единственная точка записи файлов.
 *
 * Два драйвера за одним интерфейсом, и выбор делает окружение, а не код:
 *
 *  • `r2` — Cloudflare R2, когда заданы ключи доступа. Прод и превью.
 *  • `local` — файлы в `public/media/uploads`. Разработка без аккаунта заказчика.
 *
 * Зачем локальный драйвер вообще. Ключи R2 создаются в аккаунте заказчика
 * (задача 0.4), и до этого момента любая форма с фотографией была бы
 * недоступной: заполнить занятие можно, приложить кадр — нет. Локальный драйвер
 * закрывает разработку целиком, а переезд на R2 — это две переменные окружения,
 * а не правка форм.
 *
 * Ограничение локального драйвера названо честно: на Vercel файловая система
 * только для чтения, поэтому в продакшене он откажет на старте, а не отдаст
 * «загружено» без файла. Это лучше, чем тихо потерянные фотографии.
 *
 * Ключи объектов собираются `mediaPaths` (`src/config/media.ts`) — строк путей
 * здесь нет.
 */

import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';

import { getServerEnv, isProduction } from '@/config/env';
import { mediaUrl } from '@/config/media';

export type StorageDriver = 'r2' | 'local';

export interface StoredObject {
  key: string;
  url: string;
  bytes: number;
}

/** Каталог локального хранилища внутри `public/`. */
const LOCAL_PREFIX = 'uploads';

/**
 * Какой драйвер активен. Определяется наличием всех четырёх переменных R2:
 * половина конфигурации хуже её отсутствия — подпись без секрета выглядит как
 * работающая загрузка до первого ответа 403.
 */
export function storageDriver(): StorageDriver {
  const env = getServerEnv();
  const configured =
    Boolean(env.R2_ACCOUNT_ID) &&
    Boolean(env.R2_ACCESS_KEY_ID) &&
    Boolean(env.R2_SECRET_ACCESS_KEY) &&
    Boolean(env.R2_BUCKET);

  return configured ? 'r2' : 'local';
}

export async function putMediaObject(
  key: string,
  data: Buffer,
  contentType: string,
): Promise<StoredObject> {
  if (storageDriver() === 'r2') return putToR2(key, data, contentType);
  return putToLocalDisk(key, data);
}

export async function deleteMediaObject(key: string): Promise<void> {
  if (storageDriver() === 'r2') {
    await deleteFromR2(key);
    return;
  }

  await unlink(localPathFor(key)).catch(() => {
    /* Файла может не быть: удаление идемпотентно, отсутствие — нормальный исход. */
  });
}

/* ─────────────────────────── Локальный диск ─────────────────────────── */

/**
 * Путь файла на диске. Ключ приходит из `mediaPaths`, но проверяется всё равно:
 * запись по ключу вида `../../.env` — классический traversal, и защита обязана
 * стоять у самой файловой операции, а не только у генератора ключей.
 */
function localPathFor(key: string): string {
  const root = join(process.cwd(), 'public', 'media', LOCAL_PREFIX);
  const target = normalize(join(root, key));

  if (!target.startsWith(root + sep)) {
    throw new Error('[media] Ключ объекта выходит за пределы каталога хранилища.');
  }

  return target;
}

async function putToLocalDisk(key: string, data: Buffer): Promise<StoredObject> {
  if (isProduction) {
    throw new Error(
      '[media] Локальное хранилище недоступно в production: файловая система только для чтения. ' +
        'Задайте R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY и R2_BUCKET.',
    );
  }

  const target = localPathFor(key);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);

  return { key, url: mediaUrl(`${LOCAL_PREFIX}/${key}`), bytes: data.byteLength };
}

/* ─────────────────────────────── R2 ─────────────────────────────── */

/**
 * Запись в R2.
 *
 * Не реализована намеренно, и это единственное место во всей админке, где что-то
 * не доделано. Причина: бакет и ключи создаются в аккаунте заказчика (задача 0.4
 * плана), и подписать запрос AWS SigV4 «на всякий случай» без единой возможности
 * проверить подпись — значит получить неработающую загрузку на продакшене вместо
 * понятной ошибки на старте. Когда ключи появятся, реализация — одна функция:
 * PUT `https://{account}.r2.cloudflarestorage.com/{bucket}/{key}` с
 * `Authorization: AWS4-HMAC-SHA256` (`node:crypto`, без SDK — как `webhook.ts`).
 *
 * До этого момента разработка идёт на локальном драйвере, а прод честно падает с
 * сообщением, называющим недостающие переменные.
 */
async function putToR2(key: string, data: Buffer, contentType: string): Promise<StoredObject> {
  throw new Error(
    `[media] Драйвер R2 не реализован (задача 1.6 ждёт ключи из задачи 0.4). ` +
      `Ключ: ${key}, тип: ${contentType}, байт: ${data.byteLength}.`,
  );
}

async function deleteFromR2(key: string): Promise<void> {
  throw new Error(`[media] Драйвер R2 не реализован. Удаление ключа ${key} невозможно.`);
}

/**
 * Загрузка презентационного ролика ArtDance в R2.
 *
 *   npm run promo:upload
 *
 * Кладёт три языковые версии в бакет под стабильными ключами
 * `promo/artdance-<локаль>.mp4` и проверяет каждый HEAD-запросом: размер
 * удалённого объекта должен совпасть с локальным. Без этой проверки
 * «загрузилось» и «отдаётся по CDN» — разные утверждения, и расхождение
 * всплывает уже на презентации.
 *
 * Ключи намеренно без хеша в имени: адрес ролика попадает в письма и
 * презентации, и меняющаяся ссылка там дороже, чем необходимость сбросить
 * кеш при обновлении. О перезаписи скрипт предупреждает отдельно.
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig({ path: '.env.local', override: false });
dotenvConfig({ path: '.env', override: false });

import { getServerEnv } from '../src/config/env';
import { putMediaObject, storageDriver } from '../src/lib/media/storage';

/** Локаль → файл в корне репозитория. Порядок задаёт порядок вывода. */
const VIDEOS = [
  { locale: 'ru', path: 'artdance-promo-ru.mp4' },
  { locale: 'en', path: 'artdance-promo-en.mp4' },
  { locale: 'hy', path: 'artdance-promo-hy.mp4' },
] as const;

/** Ключ объекта в бакете. Стабильный — см. комментарий в шапке. */
export const promoVideoKey = (locale: string) => `promo/artdance-${locale}.mp4`;

async function main() {
  const env = getServerEnv();
  const driver = storageDriver();
  const publicBase = (env.R2_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');

  if (driver !== 'r2' || !publicBase) {
    throw new Error(
      `Нужны R2-креды, R2_BUCKET и R2_PUBLIC_BASE_URL. Сейчас: driver=${driver}, publicBase=${publicBase || '—'}`,
    );
  }

  console.log(`driver=${driver} bucket=${env.R2_BUCKET || '—'}\n`);

  for (const { locale, path } of VIDEOS) {
    const data = await readFile(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        throw new Error(`Нет файла ${path}. Соберите ролик: см. motion/README.md, раздел «Перерендерить».`);
      }
      throw error;
    });

    const key = promoVideoKey(locale);
    const version = createHash('sha256').update(data).digest('hex').slice(0, 12);

    const result = await putMediaObject(key, data, 'video/mp4');

    const url = `${publicBase}/${key.split('/').map(encodeURIComponent).join('/')}`;
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(60_000) });
    if (!head.ok) throw new Error(`HEAD не прошёл для ${key}: ${head.status} ${head.statusText}`);

    const remoteLength = Number(head.headers.get('content-length'));
    if (remoteLength !== data.byteLength) {
      throw new Error(`Размер не совпал для ${key}: локально ${data.byteLength}, на CDN ${remoteLength}`);
    }
    if (!(head.headers.get('content-type') ?? '').includes('video/mp4')) {
      throw new Error(`Неверный content-type для ${key}: ${head.headers.get('content-type')}`);
    }

    const mb = (result.bytes / 1024 / 1024).toFixed(1);
    console.log(`${locale}  ${mb} MB  →  ${url}`);
    // Версия для сброса кеша: ключ стабильный, а отдаётся объект год как immutable.
    console.log(`     сброс кеша при обновлении: ${url}?v=${version}`);
  }

  console.log('\nГотово. Проверено HEAD-запросом: размер и content-type совпадают.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

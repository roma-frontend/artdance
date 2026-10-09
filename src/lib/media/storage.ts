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

import { createHash, createHmac } from 'node:crypto';
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
  const bucket = (((env as Record<string, unknown>).resolvedR2Bucket as string | undefined) ?? env.R2_BUCKET) as string | undefined;
  const configured =
    Boolean(env.R2_ACCOUNT_ID) &&
    Boolean(env.R2_ACCESS_KEY_ID) &&
    Boolean(env.R2_SECRET_ACCESS_KEY) &&
    Boolean(bucket);

  return configured ? 'r2' : 'local';
}

function r2Bucket(): string {
  const env = getServerEnv();
  return ((((env as Record<string, unknown>).resolvedR2Bucket as string | undefined) ?? env.R2_BUCKET ?? '') as string);
}

function r2PublicBase(): string {
  const env = getServerEnv();
  return ((((env as Record<string, unknown>).resolvedR2PublicBaseUrl as string | undefined) ?? env.R2_PUBLIC_BASE_URL ?? '') as string);
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

  return { key, url: mediaUrl(key), bytes: data.byteLength };
}

/* ─────────────────────────────── R2 ─────────────────────────────── */

const R2_SERVICE = 's3';
const R2_REGION = 'auto';

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function amzDates(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  // 20260930T123456Z
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function encodeR2Key(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

function r2PublicUrl(key: string): string {
  const base = r2PublicBase();
  if (base) {
    return `${base.replace(/\/$/, '')}/${key}`;
  }
  return mediaUrl(key);
}

export function buildR2ImageUrl(key: string): string {
  return r2PublicUrl(key);
}

function r2Endpoint(accountId: string, bucket: string, key: string): { url: string; host: string; canonicalUri: string } {
  const encodedKey = encodeR2Key(key);
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${bucket}/${encodedKey}`;
  const url = `https://${host}${canonicalUri}`;
  return { url, host, canonicalUri };
}

function buildAuthorization(input: {
  method: string;
  canonicalUri: string;
  host: string;
  payloadHash: string;
  amzDate: string;
  dateStamp: string;
  accessKeyId: string;
  secretAccessKey: string;
  contentType?: string;
  extraHeaders?: Record<string, string>;
}): { authorization: string; signedHeaders: string; canonicalHeaders: string } {
  const headers: Record<string, string> = {
    host: input.host,
    'x-amz-content-sha256': input.payloadHash,
    'x-amz-date': input.amzDate,
  };
  if (input.contentType) headers['content-type'] = input.contentType;
  if (input.extraHeaders) {
    for (const [key, value] of Object.entries(input.extraHeaders)) {
      headers[key.toLowerCase()] = value;
    }
  }

  const sortedKeys = Object.keys(headers).sort();
  const signedHeaders = sortedKeys.join(';');
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${(headers[k] ?? '').trim()}\n`).join('');

  const canonicalRequest = [
    input.method,
    input.canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join('\n');

  const credentialScope = `${input.dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    input.amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${input.secretAccessKey}`, input.dateStamp);
  const kRegion = hmacSha256(kDate, R2_REGION);
  const kService = hmacSha256(kRegion, R2_SERVICE);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = hmacSha256(kSigning, stringToSign).toString('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { authorization, signedHeaders, canonicalHeaders };
}

async function putToR2(key: string, data: Buffer, contentType: string): Promise<StoredObject> {
  const env = getServerEnv();
  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = r2Bucket();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      '[media] R2 не настроен: задайте R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY и R2_BUCKET (или R2_BUCKET_NAME).',
    );
  }

  const payloadHash = sha256Hex(data);
  const { amzDate, dateStamp } = amzDates(new Date());
  const { url, host, canonicalUri } = r2Endpoint(accountId, bucket, key);
  // Stored object must be cross-origin readable — document has CORP:same-origin
  const corsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-expose-headers': 'content-length, content-type, content-disposition',
    'cross-origin-resource-policy': 'cross-origin',
    'timing-allow-origin': '*',
    'cache-control': 'public, max-age=31536000, immutable',
  } as const;
  const { authorization } = buildAuthorization({
    method: 'PUT',
    canonicalUri,
    host,
    payloadHash,
    amzDate,
    dateStamp,
    accessKeyId,
    secretAccessKey,
    contentType,
    extraHeaders: corsHeaders,
  });

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'content-type': contentType,
      'content-length': String(data.byteLength),
      ...corsHeaders,
      authorization,
    },
    body: data as unknown as BodyInit,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`[media] R2 PUT ${response.status} ${response.statusText}${body ? `: ${body.slice(0, 2000)}` : ''}`);
  }

  return { key, url: r2PublicUrl(key), bytes: data.byteLength };
}

async function deleteFromR2(key: string): Promise<void> {
  const env = getServerEnv();
  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucket = r2Bucket();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      '[media] R2 не настроен: задайте R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY и R2_BUCKET (или R2_BUCKET_NAME).',
    );
  }

  const payloadHash = sha256Hex('');
  const { amzDate, dateStamp } = amzDates(new Date());
  const { url, host, canonicalUri } = r2Endpoint(accountId, bucket, key);
  const { authorization } = buildAuthorization({
    method: 'DELETE',
    canonicalUri,
    host,
    payloadHash,
    amzDate,
    dateStamp,
    accessKeyId,
    secretAccessKey,
  });

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      authorization,
    },
  });

  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => '');
    throw new Error(`[media] R2 DELETE ${response.status} ${response.statusText}${body ? `: ${body.slice(0, 2000)}` : ''}`);
  }
}

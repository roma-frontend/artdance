/**
 * Валидация загрузок.
 *
 * Модель угроз, которую закрывает этот модуль:
 *
 * 1. **MIME и расширение подделываются независимо друг от друга**, поэтому
 *    проверяются оба. Клиент может отправить `image/png` с именем `shell.php`.
 * 2. **Разделители пути в имени файла** позволяют вырваться из целевой папки
 *    хранилища через ключ объекта. Отсекаются до разбора расширения.
 * 3. **Размер проверяется по `Content-Length` до чтения тела**, иначе 512 MB
 *    загружаются в память ещё до того, как будут отклонены.
 *
 * Возвращается код ошибки для i18n, а не готовый текст: сообщение о слишком
 * большом файле обязано быть на языке пользователя.
 */

import { limits } from '@/config/business';
import { uploadPolicies, type UploadKind } from '@/config/security';

export type UploadRejection =
  | { code: 'FILE_TOO_LARGE'; params: { max: string } }
  | { code: 'UNSUPPORTED_TYPE'; params: { type: string } }
  | { code: 'UNSUPPORTED_EXTENSION'; params: { extension: string } }
  | { code: 'INVALID_FILE_NAME'; params: Record<string, never> }
  | { code: 'TOO_MANY_FILES'; params: { max: number } };

export type UploadValidation = { ok: true } | { ok: false; rejection: UploadRejection };

export interface UploadCandidate {
  fileName: string;
  mimeType: string | null | undefined;
  sizeBytes: number;
  kind: UploadKind;
  /** Сколько файлов уже привязано к сущности. */
  existingCount?: number;
}

/** Разделители путей и traversal. Проверяется до извлечения расширения. */
const UNSAFE_NAME = /[\\/]|\.\.|^\.|\0/;

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${Math.round(mb)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function validateUpload(candidate: UploadCandidate): UploadValidation {
  const policy = uploadPolicies[candidate.kind];

  if (candidate.existingCount !== undefined && candidate.existingCount >= policy.maxPerEntity) {
    return { ok: false, rejection: { code: 'TOO_MANY_FILES', params: { max: policy.maxPerEntity } } };
  }

  if (candidate.sizeBytes > policy.maxBytes) {
    return {
      ok: false,
      rejection: { code: 'FILE_TOO_LARGE', params: { max: formatBytes(policy.maxBytes) } },
    };
  }

  /** Параметры после `;` (charset, boundary) отбрасываются перед сравнением. */
  const mimeType = candidate.mimeType?.split(';')[0]?.trim().toLowerCase();
  if (!mimeType || !policy.mimeTypes.includes(mimeType)) {
    return { ok: false, rejection: { code: 'UNSUPPORTED_TYPE', params: { type: mimeType ?? '' } } };
  }

  if (UNSAFE_NAME.test(candidate.fileName)) {
    return { ok: false, rejection: { code: 'INVALID_FILE_NAME', params: {} } };
  }

  const extension = candidate.fileName.includes('.')
    ? candidate.fileName.split('.').pop()?.toLowerCase()
    : undefined;
  if (!extension || !policy.extensions.includes(extension)) {
    return {
      ok: false,
      rejection: { code: 'UNSUPPORTED_EXTENSION', params: { extension: extension ?? '' } },
    };
  }

  return { ok: true };
}

/**
 * Предварительная отсечка по заголовку `Content-Length` — до чтения тела запроса.
 * Допуск в 1 MB покрывает накладные расходы multipart-обёртки.
 */
export function exceedsDeclaredSize(contentLength: string | null, kind: UploadKind): boolean {
  const declared = Number(contentLength ?? 0);
  if (!Number.isFinite(declared) || declared <= 0) return false;
  return declared > uploadPolicies[kind].maxBytes + 1024 * 1024;
}

/**
 * Безопасное имя объекта в хранилище. Оригинальное имя пользователя никогда
 * не становится ключом: сохраняется только расширение, и только если оно есть.
 */
export function safeObjectName(fileName: string, uniqueId: string): string {
  if (!fileName.includes('.')) return `${uniqueId}.bin`;
  const raw = fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  const extension = raw.slice(0, 8) || 'bin';
  return `${uniqueId}.${extension}`;
}

/** Проверка на глобальные лимиты из бизнес-правил (двойная защита от рассинхрона). */
export function withinGlobalImageLimit(sizeBytes: number): boolean {
  return sizeBytes <= limits.upload.maxImageBytes;
}

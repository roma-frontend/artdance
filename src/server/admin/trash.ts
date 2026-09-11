import 'server-only';

/**
 * КОРЗИНА — чтение и три операции над удалённым.
 *
 * Единственное место, которое СПЕЦИАЛЬНО смотрит на удалённые записи. Работает
 * так же, как весь остальной код: через тот же клиент `db`. Отдельного,
 * нефильтрованного клиента у проекта нет намеренно — это был бы второй способ
 * обращаться к базе, и однажды им воспользовались бы там, где нужен первый.
 * Видимость достигается явным `onlyTrashed` в `where`: расширение клиента
 * пропускает запрос, который сам говорит про `deletedAt`.
 *
 * Прав здесь нет: их проверяет вызывающий (`trash.restore`, `trash.purge` в
 * действиях, `trash.view` на странице). Модуль `server-only`.
 *
 * ЧТО ПРОИСХОДИТ С ФАЙЛАМИ. При переносе в корзину файл в хранилище остаётся:
 * восстановленная запись без картинки — это не восстановление. При окончательном
 * удалении файл удаляется, и только тогда. Порядок обратный интуитивному: сначала
 * запись, потом файл — если удаление файла упадёт, в хранилище останется сирота,
 * что дешевле записи, которая ссылается на удалённый файл.
 */

import { adminResourceSpecs } from '@/config/admin';
import { adminResources, type AdminResource } from '@/config/routes';
import { isTrashedModel, modelDelegateKey, trash } from '@/config/trash';
import { domainErrors } from '@/domain/errors';
import { onlyTrashed, purgeCutoff } from '@/domain/trash';
import { deleteMediaObject } from '@/lib/media/storage';
import { db } from '@/lib/db';

/* ─────────────────────────────── Типы ─────────────────────────────── */

/**
 * Минимальная подпись делегата Prisma для операций корзины. Приведение — по той
 * же причине, что в реестре: делегаты тринадцати моделей имеют несовместимые
 * типы аргументов, а объединение их в `Record` даёт тип, который TypeScript
 * отказывается вызывать.
 */
interface TrashDelegate {
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
    take?: number;
    skip?: number;
    select: Record<string, unknown>;
  }): Promise<Record<string, unknown>[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
    select: { id: true };
  }): Promise<{ id: string }>;
  delete(args: { where: { id: string } }): Promise<unknown>;
  findFirst(args: {
    where: Record<string, unknown>;
    select: Record<string, unknown>;
  }): Promise<Record<string, unknown> | null>;
}

export interface TrashEntry {
  id: string;
  resource: AdminResource;
  /** Название записи так, как её называет её раздел (`primaryField`). */
  label: string;
  deletedAt: Date;
}

export interface TrashPage {
  entries: readonly TrashEntry[];
  total: number;
  page: number;
  pageCount: number;
}

/** Сколько записей в корзине по каждому разделу — для переключателя разделов. */
export type TrashCounts = Partial<Record<AdminResource, number>>;

/* ────────────────────────────── Помощники ────────────────────────────── */

/** Разделы, у которых модель поддерживает мягкое удаление. */
export const trashableResources: readonly AdminResource[] = adminResources.filter((resource) =>
  isTrashedModel(adminResourceSpecs[resource].model),
);

export function isTrashableResource(resource: AdminResource): boolean {
  return trashableResources.includes(resource);
}

function trashDelegate(resource: AdminResource): TrashDelegate {
  const spec = adminResourceSpecs[resource];

  if (!isTrashedModel(spec.model)) throw domainErrors.validationFailed('resource');

  const delegate = (db as unknown as Record<string, TrashDelegate | undefined>)[
    modelDelegateKey(spec.model)
  ];

  if (!delegate) throw new Error(`trash: нет делегата Prisma для модели ${spec.model}`);

  return delegate;
}

/**
 * Как назвать запись в списке корзины.
 *
 * `primaryField` у каждого раздела свой: у занятия это название, у промокода —
 * код, у проведения — дата начала. Дата приводится к строке здесь, а не в
 * компоненте: там она была бы отформатирована как дата удаления, а это другая дата.
 */
function labelOf(row: Record<string, unknown>, field: string): string {
  const value = row[field];

  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString();

  return '—';
}

function deletedAtOf(row: Record<string, unknown>): Date {
  const value = row.deletedAt;
  /* Выборка идёт по `onlyTrashed`, поэтому `null` здесь невозможен. */
  return value instanceof Date ? value : new Date(0);
}

/* ──────────────────────────────── Чтение ──────────────────────────────── */

/**
 * Содержимое корзины одного раздела.
 *
 * Один раздел за раз, а не всё сразу: единый список из тринадцати моделей
 * потребовал бы тринадцати запросов на каждую отрисовку страницы и сортировки в
 * приложении вместо базы. Раздел выбирается переключателем, счётчики приходят
 * отдельным дешёвым запросом.
 */
export async function listTrash(resource: AdminResource, page: number): Promise<TrashPage> {
  const spec = adminResourceSpecs[resource];
  const delegate = trashDelegate(resource);

  const take = trash.pageSize;
  const skip = Math.max(0, (page - 1) * take);

  const [rows, total] = await Promise.all([
    delegate.findMany({
      where: { ...onlyTrashed },
      orderBy: { deletedAt: 'desc' },
      take,
      skip,
      select: { id: true, deletedAt: true, [spec.primaryField]: true },
    }),
    delegate.count({ where: { ...onlyTrashed } }),
  ]);

  return {
    entries: rows.map((row) => ({
      id: String(row.id),
      resource,
      label: labelOf(row, spec.primaryField),
      deletedAt: deletedAtOf(row),
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / take)),
  };
}

/** Счётчики по разделам. Раздел без удалённого в переключателе не показывается. */
export async function trashCounts(): Promise<TrashCounts> {
  const pairs = await Promise.all(
    trashableResources.map(async (resource) => {
      const count = await trashDelegate(resource).count({ where: { ...onlyTrashed } });
      return [resource, count] as const;
    }),
  );

  const counts: TrashCounts = {};
  for (const [resource, count] of pairs) {
    if (count > 0) counts[resource] = count;
  }

  return counts;
}

/** Запись из корзины для аудита и подтверждения. `null` — её там нет. */
export async function trashedSnapshot(
  resource: AdminResource,
  id: string,
): Promise<{ id: string; label: string; deletedAt: Date } | null> {
  const spec = adminResourceSpecs[resource];

  const row = await trashDelegate(resource).findFirst({
    where: { id, ...onlyTrashed },
    select: { id: true, deletedAt: true, [spec.primaryField]: true },
  });

  if (!row) return null;

  return { id: String(row.id), label: labelOf(row, spec.primaryField), deletedAt: deletedAtOf(row) };
}

/* ────────────────────────────── Операции ────────────────────────────── */

/**
 * Возврат записи из корзины.
 *
 * `update` фильтром корзины не затронут (расширение трогает только чтение),
 * поэтому запись находится по идентификатору. Что запись действительно В корзине,
 * проверяет вызывающий через `trashedSnapshot` — иначе «восстановление» живой
 * записи прошло бы успешно и записалось в аудит как событие, которого не было.
 */
export async function restoreFromTrash(resource: AdminResource, id: string): Promise<void> {
  await trashDelegate(resource).update({
    where: { id },
    data: { deletedAt: null },
    select: { id: true },
  });
}

/**
 * Окончательное удаление одной записи вместе с её файлом.
 *
 * Отката у операции нет — поэтому у неё своё право (`trash.purge`), которое
 * нельзя выдать временным грантом.
 */
export async function purgeFromTrash(resource: AdminResource, id: string): Promise<void> {
  const storageKeys = resource === 'media' ? await mediaStorageKeys([id]) : [];

  await trashDelegate(resource).delete({ where: { id } });

  await removeFiles(storageKeys);
}

/* ─────────────────────────── Чистка по сроку ─────────────────────────── */

export interface PurgeReport {
  /** Сколько записей удалено по каждому разделу. Пустой отчёт — чистить нечего. */
  purged: Partial<Record<AdminResource, number>>;
  total: number;
  /** Сколько файлов убрано из хранилища. */
  filesRemoved: number;
}

/**
 * Удаление всего, что пролежало в корзине дольше срока хранения.
 *
 * Порциями (`trash.purgeBatchSize`) и по одному разделу за раз: первый запуск
 * после долгого простоя иначе означает одну транзакцию на десять тысяч записей с
 * каскадами, то есть блокировки на минуты. Остаток уйдёт на следующем запуске —
 * задача идемпотентна по построению.
 *
 * `now` приходит аргументом, чтобы чистку можно было проверить и воспроизвести.
 */
export async function purgeExpiredTrash(now: Date): Promise<PurgeReport> {
  const cutoff = purgeCutoff(now);
  const expired = { deletedAt: { lt: cutoff } };

  const purged: Partial<Record<AdminResource, number>> = {};
  let total = 0;
  let filesRemoved = 0;

  for (const resource of trashableResources) {
    const delegate = trashDelegate(resource);

    const rows = await delegate.findMany({
      where: expired,
      orderBy: { deletedAt: 'asc' },
      take: trash.purgeBatchSize,
      select: { id: true },
    });

    if (rows.length === 0) continue;

    const ids = rows.map((row) => String(row.id));
    const storageKeys = resource === 'media' ? await mediaStorageKeys(ids) : [];

    /*
     * По одной записи, а не `deleteMany`: у моделей есть каскады, и падение на
     * одной записи не должно отменять уже удалённые — иначе задача не сдвинется
     * с места никогда.
     */
    for (const id of ids) {
      await delegate.delete({ where: { id } });
      total += 1;
      purged[resource] = (purged[resource] ?? 0) + 1;
    }

    filesRemoved += await removeFiles(storageKeys);
  }

  return { purged, total, filesRemoved };
}

/* ─────────────────────────────── Файлы ─────────────────────────────── */

/** Ключи файлов удаляемых кадров. Читаются ДО удаления записей. */
async function mediaStorageKeys(ids: readonly string[]): Promise<readonly string[]> {
  const rows = await db.mediaAsset.findMany({
    where: { id: { in: [...ids] }, ...onlyTrashed },
    select: { storageKey: true },
  });

  return rows.map((row) => row.storageKey);
}

/**
 * Удаление файлов из хранилища.
 *
 * Ошибка на файле не роняет операцию: запись из базы уже ушла, и повторить
 * удаление файла можно, а вернуть запись — нет. Сирота в хранилище стоит места,
 * а не корректности.
 */
async function removeFiles(keys: readonly string[]): Promise<number> {
  let removed = 0;

  for (const key of keys) {
    try {
      await deleteMediaObject(key);
      removed += 1;
    } catch (error) {
      console.error(`trash: не удалось удалить файл ${key}`, error);
    }
  }

  return removed;
}

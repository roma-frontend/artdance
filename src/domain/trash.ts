/**
 * ПРАВИЛА КОРЗИНЫ — чистые функции без Prisma и без запросов.
 *
 * Здесь живёт то единственное преобразование, от которого зависит, не утечёт ли
 * удалённая запись в публичный каталог: подмешивание `deletedAt: null` в аргументы
 * чтения. Оно вынесено из клиента (`src/lib/db.ts`) сюда именно для того, чтобы
 * его можно было проверить тестом — модуль клиента `server-only` и в тестовой
 * среде не поднимается.
 */

import { isTrashFilteredOperation, isTrashedModel, trash } from '@/config/trash';

/** Условие «запись жива». Одна константа на проект, включая фильтры связей. */
export const notTrashed = { deletedAt: null } as const;

/** Условие «запись в корзине». Явное упоминание `deletedAt` отключает подмешивание. */
export const onlyTrashed = { deletedAt: { not: null } } as const;

interface ArgsWithWhere {
  where?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Аргументы чтения с отсечённой корзиной.
 *
 * Три правила, и каждое закрывает свой случай:
 *
 * 1. **Модель без мягкого удаления не трогается.** У заказа нет `deletedAt`, и
 *    добавленный фильтр дал бы ошибку Prisma на каждом запросе.
 * 2. **Операция записи не трогается.** Иначе восстановление (`update` записи,
 *    которой «нет») перестало бы находить свою строку.
 * 3. **Запрос, который САМ говорит про `deletedAt`, не трогается.** Это и есть
 *    способ работать с корзиной: раздел корзины передаёт `onlyTrashed`, чистка —
 *    срок. Без этого исключения понадобился бы второй, нефильтрованный клиент —
 *    то есть второй способ обращаться к базе, и однажды им воспользовались бы не
 *    там.
 *
 * Проверяется только ВЕРХНИЙ уровень `where`. Условие внутри `OR`/`AND` фильтр не
 * отключает: `OR` с упоминанием `deletedAt` в одной ветке ничего не гарантирует о
 * других, и «я знаю, что делаю» тут было бы неправдой.
 */
export function readArgsWithoutTrashed(
  model: string,
  operation: string,
  args: unknown,
): unknown {
  if (!isTrashedModel(model)) return args;
  if (!isTrashFilteredOperation(operation)) return args;

  /* `count()` и `findMany()` вызываются вообще без аргументов. */
  if (!isRecord(args)) return { where: { ...notTrashed } };

  const current = (args as ArgsWithWhere).where;

  if (isRecord(current) && 'deletedAt' in current) return args;

  return { ...args, where: { ...(isRecord(current) ? current : {}), ...notTrashed } };
}

/**
 * Момент, раньше которого запись в корзине подлежит окончательному удалению.
 *
 * Считается от переданного «сейчас», а не от `new Date()` внутри: время — это
 * вход, иначе функцию нельзя проверить, а чистку — воспроизвести.
 */
export function purgeCutoff(now: Date): Date {
  return new Date(now.getTime() - trash.retentionDays * 24 * 60 * 60 * 1000);
}

/**
 * Сколько дней записи осталось лежать в корзине. Отрицательного не возвращает:
 * «просрочена на три дня» администратору не нужно, ему нужно «будет удалена».
 */
export function daysLeftInTrash(deletedAt: Date, now: Date): number {
  const elapsedDays = (now.getTime() - deletedAt.getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(trash.retentionDays - elapsedDays));
}

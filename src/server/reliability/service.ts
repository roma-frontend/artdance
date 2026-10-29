import 'server-only';

import { db } from '@/lib/db';
import { nextReliabilityScore } from '@/domain/reliability';
import type { ReliabilityKind } from '@/domain/reliability';

/** Клиент записи: `db` или транзакция вызывающего, в которой уже меняется статус брони. */
export type ReliabilityClient = Pick<typeof db, 'reliabilityEvent' | 'user'>;

export interface ReliabilityEventInput {
  userId: string;
  kind: ReliabilityKind;
  /** Объект события (id брони, id спора): пара (kind, refId) засчитывается один раз. */
  refId: string;
}

/** `recorded: false` — такое событие уже записано: ни строки, ни изменения счёта. */
export type ReliabilityRecord = { recorded: false } | { recorded: true; previous: number; next: number };

/**
 * Записывает событие надёжности и пересчитывает счёт, идемпотентно по (userId, kind, refId).
 * С клиентом пишет в его транзакцию. Без клиента открывает свою: иначе сбой между строкой и счётом
 * оставит строку-дубль без изменения счёта, и повтор уже ничего не засчитает.
 */
export function recordReliabilityEvent(input: ReliabilityEventInput, client?: ReliabilityClient): Promise<ReliabilityRecord> {
  if (client) return writeReliabilityEvent(client, input);
  return db.$transaction((tx) => writeReliabilityEvent(tx, input));
}

async function writeReliabilityEvent(client: ReliabilityClient, input: ReliabilityEventInput): Promise<ReliabilityRecord> {
  const duplicate = await client.reliabilityEvent.findFirst({
    where: { userId: input.userId, kind: input.kind, refId: input.refId },
    select: { id: true },
  });
  if (duplicate) return { recorded: false };

  await client.reliabilityEvent.create({ data: { userId: input.userId, kind: input.kind, refId: input.refId } });
  const { reliabilityScore: previous } = await client.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { reliabilityScore: true },
  });
  const next = nextReliabilityScore(previous, input.kind);
  await client.user.update({ where: { id: input.userId }, data: { reliabilityScore: next } });
  return { recorded: true, previous, next };
}

export async function reliabilityFor(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { reliabilityScore: true } });
  return user?.reliabilityScore ?? 100;
}

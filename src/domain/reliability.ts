/**
 * RELIABILITY (D-07) — индекс надёжности пользователя.
 * События: no-show (-15), late-cancel (-10), completed (+2, капает до 100), dispute-lost (-20).
 */

export const reliabilityKinds = ['NO_SHOW', 'LATE_CANCEL', 'COMPLETED', 'DISPUTE_LOST'] as const;
export type ReliabilityKind = (typeof reliabilityKinds)[number];

const deltas: Record<ReliabilityKind, number> = { NO_SHOW: -15, LATE_CANCEL: -10, COMPLETED: 2, DISPUTE_LOST: -20 };

export function reliabilityDelta(kind: ReliabilityKind): number { return deltas[kind] ?? 0; }

export function nextReliabilityScore(current: number, kind: ReliabilityKind): number {
  const next = current + reliabilityDelta(kind);
  return Math.max(0, Math.min(100, next));
}

const MS_PER_HOUR = 60 * 60 * 1000;

/** Поздняя отмена: занятие ещё не началось, а до старта меньше окна бесплатной отмены брони. */
export function isLateCancellation(input: { now: Date; startsAt: Date; cancellationWindowHours: number }): boolean {
  const untilStart = input.startsAt.getTime() - input.now.getTime();
  return untilStart >= 0 && untilStart < input.cancellationWindowHours * MS_PER_HOUR;
}

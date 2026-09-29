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

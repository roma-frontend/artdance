import 'server-only';

import { db } from '@/lib/db';
import { nextReliabilityScore } from '@/domain/reliability';
import type { ReliabilityKind } from '@/domain/reliability';

export async function recordReliabilityEvent(input: { userId: string; kind: ReliabilityKind; refId?: string | null }) {
  await db.reliabilityEvent.create({ data: { userId: input.userId, kind: input.kind, refId: input.refId ?? null } });
  const user = await db.user.findUnique({ where: { id: input.userId }, select: { reliabilityScore: true } });
  const current = (user as unknown as { reliabilityScore: number } | null)?.reliabilityScore ?? 100;
  const next = nextReliabilityScore(current, input.kind);
  await db.user.update({ where: { id: input.userId }, data: { reliabilityScore: next } });
  return { previous: current, next };
}

export async function reliabilityFor(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { reliabilityScore: true } });
  return (user as unknown as { reliabilityScore: number } | null)?.reliabilityScore ?? 100;
}

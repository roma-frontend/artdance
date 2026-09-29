/**
 * PROGRESS JOURNAL (C-10) — журнал прогресса: визиты, фигуры, стрик.
 * Домен даёт агрегаты + гейт Pro (quota.progressJournal).
 */

export interface JournalEntry {
  visitedAt: Date;
  figures?: string[];
}

export function streakFrom(entries: readonly JournalEntry[]): number {
  if (entries.length === 0) return 0;
  const sorted = [...entries].sort((a, b) => a.visitedAt.getTime() - b.visitedAt.getTime());
  let streak = 1;
  for (let i = sorted.length - 1; i > 0; i--) {
    const diffDays = Math.round((sorted[i]!.visitedAt.getTime() - sorted[i - 1]!.visitedAt.getTime()) / 86_400_000);
    if (diffDays === 1) streak += 1;
    else if (diffDays > 1) break;
  }
  return streak;
}

export function figureCounts(entries: readonly JournalEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entries) for (const f of e.figures ?? []) counts[f] = (counts[f] ?? 0) + 1;
  return counts;
}

export function canViewJournal(hasPro: boolean): boolean { return hasPro; }

import 'server-only';

import { db } from '@/lib/db';
import { streakFrom, figureCounts } from '@/domain/progress-journal';

export async function userProgressJournal(userId: string) {
  const enrollments = await db.courseEnrollment.findMany({ where: { userId }, select: { id: true } });
  const eids = (enrollments as unknown as { id: string }[]).map((e) => e.id);
  if (eids.length === 0) return { totalVisits: 0, streak: 0, figureCounts: {} as Record<string, number>, completedLessons: 0 };
  const progress = await db.lessonProgress.findMany({ where: { enrollmentId: { in: eids } }, select: { completedAt: true, lessonId: true } });
  const completed = (progress as unknown as { completedAt: Date | null; lessonId: string }[]).filter((p) => p.completedAt !== null);
  // Figure mapping: CourseLesson.learningOutcomes (if any) — fallback to lessonId counts
  const entries = completed.map((p) => ({ visitedAt: p.completedAt as Date, figures: [p.lessonId] }));
  return {
    totalVisits: completed.length,
    streak: streakFrom(entries),
    figureCounts: figureCounts(entries),
    completedLessons: completed.length,
  };
}

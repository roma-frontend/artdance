/**
 * SCHEDULE GRID (A-02) — недельная сетка.
 * Данные — уже в DanceClass + InstructorProfile + Venue; сетка — производная от
 * isActive/isTrending + доступности, фильтруется по «сегодня».
 */

export type ScheduleSlot = {
  id: string;
  title: string;
  style: string;
  venueName: string | null;
  isTrending: boolean;
  slug: string;
};

export function todaySlots(slots: readonly ScheduleSlot[], today: string | null): readonly ScheduleSlot[] {
  if (!today) return slots;
  // Заглушка: пока без WeeklySlot — возвращаем всё, фильтр «сегодня» подключается когда поле появится в схеме
  void today;
  return slots;
}

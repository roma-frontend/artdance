import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  instructorProfile: { findFirst: vi.fn(), findMany: vi.fn() },
  danceClass: { findFirst: vi.fn() },
  classSession: { findMany: vi.fn() },
  availabilityRule: { findMany: vi.fn() },
  availabilityException: { findMany: vi.fn() },
  booking: { findMany: vi.fn() },
  slotHold: { findMany: vi.fn() },
}));
vi.mock('@/lib/db', () => ({ db }));

import { booking } from '@/config/business';
import { slotBlockingBookingStatuses } from '@/domain/enums';
import { getAlternativeSlots, getBookableInstructors, getInstructorBookingContent } from './booking';

const now = new Date('2026-09-07T08:00:00Z');
const instructor = { id: 'profile-1', slug: 'teacher', user: { name: 'Teacher' }, acceptsTravel: false };
const classItem = {
  id: 'class-1', slug: 'lesson', title: 'Lesson', durationMinutes: 60, price: 17_000,
  translations: [{ title: 'Занятие' }],
  venue: { slug: 'studio', name: 'Studio', deletedAt: null, translations: [{ name: 'Студия' }] },
};
const interval = (start: string, end: string) => ({ startsAt: new Date(start), endsAt: new Date(end) });

beforeEach(() => {
  vi.resetAllMocks();
  db.instructorProfile.findFirst.mockResolvedValue(instructor);
  db.instructorProfile.findMany.mockResolvedValue([]);
  db.danceClass.findFirst.mockResolvedValue(classItem);
  db.availabilityRule.findMany.mockResolvedValue([
    { weekday: 2, startTime: '10:00', endTime: '16:00', isActive: true },
  ]);
  db.availabilityException.findMany.mockResolvedValue([]);
  db.booking.findMany.mockResolvedValue([]);
  db.slotHold.findMany.mockResolvedValue([]);
});

const content = async () => {
  const result = await getInstructorBookingContent(instructor.slug, now, 'ru');
  if (result && 'kind' in result) throw new Error('Expected a bookable class');
  return result;
};

describe('календарь бронирования из БД', () => {
  it('не показывает отсутствующий или непубличный профиль', async () => {
    db.instructorProfile.findFirst.mockResolvedValue(null);
    expect(await content()).toBeNull();
    expect(await getAlternativeSlots('unknown', 3, now)).toBeNull();
    expect(db.instructorProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ moderation: 'APPROVED', publishedAt: { not: null }, user: { isActive: true } }),
    }));
    expect(db.availabilityRule.findMany).not.toHaveBeenCalled();
  });

  it('без занятия возвращает публичный профиль для пустого состояния без запросов слотов', async () => {
    db.danceClass.findFirst.mockResolvedValue(null);
    expect(await getInstructorBookingContent(instructor.slug, now, 'ru')).toEqual({
      kind: 'no-classes', instructorSlug: instructor.slug, instructorName: instructor.user.name,
    });
    expect(db.availabilityRule.findMany).not.toHaveBeenCalled();
    expect(db.slotHold.findMany).not.toHaveBeenCalled();
    expect(await getAlternativeSlots(instructor.slug, 3, now)).toEqual([]);
  });

  it('явно указанное неизвестное занятие не подменяется пустым состоянием', async () => {
    db.danceClass.findFirst.mockResolvedValue(null);
    expect(await getInstructorBookingContent(instructor.slug, now, 'ru', 'unknown')).toBeNull();
    expect(db.classSession.findMany).not.toHaveBeenCalled();
  });

  it('читает цену, длительность, переводы и настоящий ID', async () => {
    expect(await content()).toMatchObject({
      instructorId: 'profile-1', instructorName: 'Teacher', classSlug: 'lesson',
      classTitle: 'Занятие', studioName: 'Студия', fee: 17_000, durationMinutes: 60,
      acceptsTravel: false, acceptsOnline: false,
    });
    expect(db.danceClass.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ instructorId: instructor.id, isActive: true }),
      orderBy: { id: 'asc' },
    }));
  });

  it('открывает рабочие дни по порядку в пределах горизонта и выбирает первое свободное время', async () => {
    const result = (await content())!;
    const keys = result.days.map(day => day.dateKey);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toEqual([...new Set(keys)].sort());
    expect(result.days[0]?.dateKey).toBe('2026-09-08');
    expect(result.preselectedSlot).toBe('10:00');
    expect(new Date(result.days.at(-1)!.dateIso).getTime() - now.getTime())
      .toBeLessThanOrEqual(booking.maxAdvanceDays * 86_400_000);
  });

  it('бронь и активное удержание остаются в сетке недоступными', async () => {
    db.booking.findMany.mockResolvedValue([interval('2026-09-08T06:00:00Z', '2026-09-08T07:00:00Z')]);
    db.slotHold.findMany.mockResolvedValue([interval('2026-09-08T08:00:00Z', '2026-09-08T09:00:00Z')]);
    const result = (await content())!;
    const slots = result.days[0]!.slots;
    expect(slots.find(slot => slot.start === '10:00')?.available).toBe(false);
    expect(slots.find(slot => slot.start === '12:00')?.available).toBe(false);
    expect(slots.some(slot => slot.available)).toBe(true);
    const alternatives = (await getAlternativeSlots(instructor.slug, 3, now))!;
    expect(alternatives.every(slot => !['2026-09-08T06:00:00.000Z', '2026-09-08T08:00:00.000Z'].includes(slot.startIso))).toBe(true);
  });

  it('выбирает только блокирующие брони и непросроченные удержания по ID', async () => {
    await content();
    expect(db.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ instructorId: instructor.id, status: { in: [...slotBlockingBookingStatuses] } }),
    }));
    expect(db.slotHold.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ instructorId: instructor.id, expiresAt: { gt: now } }),
    }));
  });

  it('учитывает отпуск и разовое доступное окно', async () => {
    db.availabilityException.findMany.mockResolvedValue([
      { ...interval('2026-09-08T06:00:00Z', '2026-09-08T12:00:00Z'), isAvailable: false },
      { ...interval('2026-09-09T06:00:00Z', '2026-09-09T08:00:00Z'), isAvailable: true },
    ]);
    const result = (await content())!;
    expect(result.days.some(day => day.dateKey === '2026-09-08')).toBe(false);
    expect(result.initialDateKey).toBe('2026-09-09');
  });

  it('без расписания не выдумывает времена', async () => {
    db.availabilityRule.findMany.mockResolvedValue([]);
    expect(await content()).toMatchObject({ days: [], initialDateKey: null, preselectedSlot: null });
    expect(await getAlternativeSlots(instructor.slug, 3, now)).toEqual([]);
  });

  it('повторный запрос перечитывает занятость без кеша', async () => {
    await content();
    await content();
    expect(db.booking.findMany).toHaveBeenCalledTimes(2);
    expect(db.slotHold.findMany).toHaveBeenCalledTimes(2);
  });

  it('выбранное занятие показывает только реальные проведения с ID и вместимостью', async () => {
    db.classSession.findMany.mockResolvedValue([
      { id: 'session-1', ...interval('2026-09-08T14:00:00Z', '2026-09-08T15:00:00Z'), capacity: 5, bookedCount: 5 },
      { id: 'session-2', ...interval('2026-09-09T14:00:00Z', '2026-09-09T15:00:00Z'), capacity: 5, bookedCount: 2 },
    ]);
    const result = (await getInstructorBookingContent('teacher', now, 'ru', 'lesson'))!;
    if ('kind' in result) throw new Error('Expected a session booking');
    expect(result.sessionBooking).toBe(true);
    expect(result.days[0]?.slots[0]).toMatchObject({ sessionId: 'session-1', available: false, start: '18:00' });
    expect(result.initialDateKey).toBe('2026-09-09');
    expect(result.days[1]?.slots[0]).toMatchObject({ sessionId: 'session-2', available: true });
    expect(db.danceClass.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ slug: 'lesson', instructorId: 'profile-1' }),
    }));
    expect(db.classSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ classId: 'class-1', isCancelled: false, deletedAt: null }),
    }));
  });

  it('бронь той же группы не закрывает оставшиеся места, активное удержание закрывает', async () => {
    const times = interval('2026-09-08T14:00:00Z', '2026-09-08T15:00:00Z');
    db.classSession.findMany.mockResolvedValue([{ id: 'session-1', ...times, capacity: 5, bookedCount: 1 }]);
    db.booking.findMany.mockResolvedValue([{ ...times, sessionId: 'session-1' }]);
    const available = await getInstructorBookingContent('teacher', now, 'ru', 'lesson');
    if (!available || 'kind' in available) throw new Error('Expected a session booking');
    expect(available.days[0]?.slots[0]?.available).toBe(true);
    db.slotHold.findMany.mockResolvedValue([times]);
    const occupied = await getInstructorBookingContent('teacher', now, 'ru', 'lesson');
    if (!occupied || 'kind' in occupied) throw new Error('Expected a session booking');
    expect(occupied.days[0]?.slots[0]?.available).toBe(false);
  });

  it('в список входят только публичные профили с неудалёнными занятиями', async () => {
    expect(await getBookableInstructors('ru')).toEqual([]);
    expect(db.instructorProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        moderation: 'APPROVED', classes: { some: expect.objectContaining({ deletedAt: null, isActive: true }) },
      }),
    }));
  });
});

/**
 * Тесты контента экрана бронирования.
 *
 * Проверяется шов между движком доступности и экраном: календарь не должен
 * открывать дни, в которые инструктор не принимает, а занятые времена обязаны
 * оставаться в сетке недоступными — иначе день выглядит менее рабочим, чем он есть.
 *
 * `now` фиксирован: доступность зависит от даты запуска, и тест, который зависит
 * от неё, краснеет по вторникам.
 */

import { describe, expect, it } from 'vitest';

import { demoTakenSlots } from '../../../prisma/fixtures/demo';
import { booking } from '@/config/business';
import { zonedParts } from '@/lib/time/schedule';

import { getBookableInstructors, getInstructorBookingContent } from './booking';

/** Понедельник 7 сентября 2026, 12:00 по Еревану. */
const now = new Date('2026-09-07T08:00:00Z');

/** Anna Mkrtchyan принимает во вторник, четверг и субботу. */
const annaWeekdays = new Set([2, 4, 6]);

describe('getInstructorBookingContent', () => {
  it('возвращает null для неизвестного инструктора: страница отвечает 404', () => {
    expect(getInstructorBookingContent('нет-такого', now)).toBeNull();
  });

  it('открывает только те дни, в которые инструктор принимает', () => {
    const content = getInstructorBookingContent('anna-mkrtchyan', now);

    expect(content?.days.length).toBeGreaterThan(0);
    for (const day of content!.days) {
      expect(annaWeekdays.has(zonedParts(new Date(day.dateIso)).weekday)).toBe(true);
    }
  });

  it('дни идут по возрастанию и не повторяются', () => {
    const keys = getInstructorBookingContent('anna-mkrtchyan', now)!.days.map((day) => day.dateKey);

    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('не выходит за горизонт бронирования', () => {
    const content = getInstructorBookingContent('anna-mkrtchyan', now)!;
    const last = content.days.at(-1)!;
    const horizonDays =
      (new Date(last.dateIso).getTime() - now.getTime()) / (24 * 60 * 60 * 1_000);

    expect(horizonDays).toBeLessThanOrEqual(booking.maxAdvanceDays);
  });

  it('занятые времена макета остаются в сетке недоступными, а не исчезают', () => {
    const content = getInstructorBookingContent('anna-mkrtchyan', now)!;
    const firstDay = content.days[0]!;

    for (const taken of demoTakenSlots) {
      const slot = firstDay.slots.find((item) => item.start === taken);
      expect(slot, `слот ${taken} обязан остаться в сетке`).toBeDefined();
      expect(slot?.available, `слот ${taken} обязан быть недоступным`).toBe(false);
    }
  });

  it('в дне есть и свободные времена: экран не может состоять из зачёркнутого', () => {
    const content = getInstructorBookingContent('anna-mkrtchyan', now)!;

    expect(content.days[0]!.slots.some((slot) => slot.available)).toBe(true);
  });

  it('сетка выровнена по шагу расписания', () => {
    const content = getInstructorBookingContent('anna-mkrtchyan', now)!;

    for (const slot of content.days[0]!.slots) {
      const [hours, minutes] = slot.start.split(':').map(Number);
      expect(((hours! * 60 + minutes!) % booking.slotGranularityMinutes)).toBe(0);
    }
  });

  it('предвыбирает время из макета, и оно свободно', () => {
    const content = getInstructorBookingContent('anna-mkrtchyan', now)!;
    const initial = content.days.find((day) => day.dateKey === content.initialDateKey)!;

    expect(content.preselectedSlot).toBe('18:00');
    expect(initial.slots.find((slot) => slot.start === '18:00')?.available).toBe(true);
  });

  it('первый открытый день содержит свободное время', () => {
    const content = getInstructorBookingContent('anna-mkrtchyan', now)!;
    const initial = content.days.find((day) => day.dateKey === content.initialDateKey);

    expect(initial?.slots.some((slot) => slot.available)).toBe(true);
  });

  it('цена и длительность берутся у занятия, а не выдумываются', () => {
    const content = getInstructorBookingContent('anna-mkrtchyan', now)!;

    expect(content.classSlug).toBe('latin-fusion');
    expect(content.durationMinutes).toBe(90);
    expect(content.fee).toBe(12_000);
  });

  it('у разных инструкторов разные рабочие дни', () => {
    const anna = getInstructorBookingContent('anna-mkrtchyan', now)!;
    const arman = getInstructorBookingContent('arman-harutyunyan', now)!;

    const weekday = (dateIso: string) => zonedParts(new Date(dateIso)).weekday;

    expect(new Set(anna.days.map((day) => weekday(day.dateIso)))).not.toEqual(
      new Set(arman.days.map((day) => weekday(day.dateIso))),
    );
  });
});

describe('getBookableInstructors', () => {
  it('возвращает только инструкторов с занятиями: ссылка обязана открываться', () => {
    for (const instructor of getBookableInstructors()) {
      expect(getInstructorBookingContent(instructor.slug, now)).not.toBeNull();
    }
  });
});

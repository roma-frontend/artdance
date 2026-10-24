import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextClassStart, nextDateOn, yerevanDate } from './class-time.ts';

// Ереван = UTC+4. Суббота 2026-10-24, 10:00 по Еревану = 06:00 UTC.
const SAT_10_YEREVAN = Date.UTC(2026, 9, 24, 6, 0);

test('yerevanDate uses UTC+4, not the UTC date', () => {
  // 23:30 UTC 24 октября — это уже 25 октября в Ереване.
  assert.equal(yerevanDate(Date.UTC(2026, 9, 24, 23, 30)), '2026-10-25');
  assert.equal(yerevanDate(SAT_10_YEREVAN), '2026-10-24');
});

test('nextDateOn returns the same day when the weekday matches', () => {
  assert.equal(nextDateOn(6, '2026-10-24'), '2026-10-24');
});

test('nextDateOn wraps across the week', () => {
  // Воскресенье (0) после субботы — завтра.
  assert.equal(nextDateOn(0, '2026-10-24'), '2026-10-25');
});

test('class later today is booked for today', () => {
  assert.equal(nextClassStart(6, '18:00', SAT_10_YEREVAN).toISOString(), '2026-10-24T14:00:00.000Z');
});

test('class earlier today already started rolls to next week', () => {
  assert.equal(nextClassStart(6, '09:00', SAT_10_YEREVAN).toISOString(), '2026-10-31T05:00:00.000Z');
});

test('class on a later weekday is the next occurrence', () => {
  assert.equal(nextClassStart(0, '10:00', SAT_10_YEREVAN).toISOString(), '2026-10-25T06:00:00.000Z');
});

test('late night in Yerevan picks the next day for a class after midnight', () => {
  // 23:30 Ереван в субботу = 19:30 UTC. Занятие в воскресенье 00:30 — через час.
  const lateSat = Date.UTC(2026, 9, 24, 19, 30);
  assert.equal(nextClassStart(0, '00:30', lateSat).toISOString(), '2026-10-24T20:30:00.000Z');
});

test('just after midnight in Yerevan uses the new calendar day', () => {
  // 00:30 Ереван в субботу = 20:30 UTC в пятницу. Занятие в субботу 01:00 — сегодня.
  const earlySat = Date.UTC(2026, 9, 24, 20, 30);
  assert.equal(nextClassStart(6, '01:00', earlySat).toISOString(), '2026-10-30T21:00:00.000Z');
});

import { describe, expect, it } from 'vitest';

import { extractBookingIntents, MAX_BOOKING_INTENTS } from './booking-intent';

describe('extractBookingIntents', () => {
  it('returns the text unchanged when there is no token', () => {
    expect(extractBookingIntents('Hello, here are two classes.')).toEqual({
      text: 'Hello, here are two classes.',
      sessionIds: [],
    });
  });

  it('strips a booking token and returns its session id', () => {
    const result = extractBookingIntents('Great choice, it fits your level.\n[[book:cmabc123def]]');
    expect(result.sessionIds).toEqual(['cmabc123def']);
    expect(result.text).toBe('Great choice, it fits your level.');
  });

  it('removes duplicate tokens and keeps the first occurrence order', () => {
    const result = extractBookingIntents('[[book:sess0001]] [[book:sess0002]] [[book:sess0001]]');
    expect(result.sessionIds).toEqual(['sess0001', 'sess0002']);
    expect(result.text).toBe('');
  });

  it('caps the number of booking intents', () => {
    const tokens = ['a1b2c3d4', 'e5f6g7h8', 'i9j0k1l2'].map((id) => `[[book:${id}]]`).join(' ');
    const result = extractBookingIntents(tokens);
    expect(result.sessionIds).toHaveLength(MAX_BOOKING_INTENTS);
    expect(result.sessionIds).toEqual(['a1b2c3d4', 'e5f6g7h8']);
  });

  it('ignores malformed tokens and leaves them in the text', () => {
    const result = extractBookingIntents('See [[book:]] and [[book:ab]] and [[other:abcdef]].');
    expect(result.sessionIds).toEqual([]);
    expect(result.text).toBe('See [[book:]] and [[book:ab]] and [[other:abcdef]].');
  });

  it('collapses the blank lines left behind by a removed token', () => {
    const result = extractBookingIntents('First line\n\n[[book:sess0001]]\n\n\nLast line');
    expect(result.text).toBe('First line\n\nLast line');
  });
});

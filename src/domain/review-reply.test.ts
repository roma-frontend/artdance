import { describe, expect, it } from 'vitest';

import { replyAllowedFor, replyLengths, replyValid } from '@/domain/review-reply';

describe('replyValid', () => {
  it('accepts a reply from the minimum to the maximum length', () => {
    expect(replyValid('x'.repeat(replyLengths.min))).toBe(true);
    expect(replyValid('x'.repeat(replyLengths.max))).toBe(true);
  });

  it('rejects a reply below the minimum and above the maximum', () => {
    expect(replyValid('x'.repeat(replyLengths.min - 1))).toBe(false);
    expect(replyValid('x'.repeat(replyLengths.max + 1))).toBe(false);
  });

  it('measures the length after trimming spaces', () => {
    expect(replyValid(`   ${'x'.repeat(replyLengths.min - 1)}   `)).toBe(false);
  });
});

describe('replyAllowedFor', () => {
  it('allows a reply only under an approved review', () => {
    expect(replyAllowedFor('APPROVED')).toBe(true);
    expect(replyAllowedFor('PENDING')).toBe(false);
    expect(replyAllowedFor('REJECTED')).toBe(false);
  });
});

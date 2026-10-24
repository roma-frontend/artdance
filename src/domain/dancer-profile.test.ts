import { describe, expect, it } from 'vitest';

import { limits } from '@/config/business';

import { dancerOnboardingSchema, emptyToNull } from './dancer-profile';

describe('dancerOnboardingSchema', () => {
  it('requires a level', () => {
    expect(dancerOnboardingSchema.safeParse({ styles: [], completed: false }).success).toBe(false);
  });

  it('accepts a level alone and defaults styles and completed', () => {
    const parsed = dancerOnboardingSchema.parse({ level: 'BEGINNER' });
    expect(parsed.styles).toEqual([]);
    expect(parsed.completed).toBe(false);
  });

  it('rejects an unknown dance style', () => {
    expect(dancerOnboardingSchema.safeParse({ level: 'BEGINNER', styles: ['NOT_A_STYLE'] }).success).toBe(false);
  });

  it('trims goal and note', () => {
    const parsed = dancerOnboardingSchema.parse({ level: 'ADVANCED', goal: '  wedding  ', note: ' ' });
    expect(parsed.goal).toBe('wedding');
    expect(parsed.note).toBe('');
  });

  it('rejects a goal over the shared text limit', () => {
    const goal = 'x'.repeat(limits.text.messageMax + 1);
    expect(dancerOnboardingSchema.safeParse({ level: 'BEGINNER', goal }).success).toBe(false);
  });
});

describe('emptyToNull', () => {
  it('maps blank and missing values to null', () => {
    expect(emptyToNull('   ')).toBeNull();
    expect(emptyToNull(undefined)).toBeNull();
    expect(emptyToNull(null)).toBeNull();
  });

  it('keeps non-blank text trimmed', () => {
    expect(emptyToNull('  salsa  ')).toBe('salsa');
  });
});

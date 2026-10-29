import { describe, expect, it } from 'vitest';

import { extractReferralCode, parseReferralCode } from '@/domain/referral';

describe('parseReferralCode', () => {
  it('нормализует регистр и пробелы по краям', () => {
    expect(parseReferralCode(' abc12345 ')).toBe('ABC12345');
  });

  it('отбрасывает отсутствующее, пустое и неподходящее значение', () => {
    expect(parseReferralCode(null)).toBeNull();
    expect(parseReferralCode(undefined)).toBeNull();
    expect(parseReferralCode('')).toBeNull();
    expect(parseReferralCode('   ')).toBeNull();
    expect(parseReferralCode('abc-123')).toBeNull();
    expect(parseReferralCode('<script>')).toBeNull();
    expect(parseReferralCode('A'.repeat(17))).toBeNull();
  });

  it('принимает код максимальной длины', () => {
    expect(parseReferralCode('a'.repeat(16))).toBe('A'.repeat(16));
  });
});

describe('extractReferralCode', () => {
  it('возвращает код и адрес без параметра, остальные параметры сохраняет', () => {
    const result = extractReferralCode(
      new URL('http://localhost:3000/hy/classes?ref=abc12345&tab=week'),
      'ref',
    );
    expect(result?.code).toBe('ABC12345');
    expect(result?.cleanUrl.toString()).toBe('http://localhost:3000/hy/classes?tab=week');
  });

  it('убирает единственный параметр целиком', () => {
    const result = extractReferralCode(new URL('http://localhost:3000/hy?ref=abc12345'), 'ref');
    expect(result?.cleanUrl.toString()).toBe('http://localhost:3000/hy');
  });

  it('возвращает null без параметра и при неверном значении', () => {
    expect(extractReferralCode(new URL('http://localhost:3000/hy'), 'ref')).toBeNull();
    expect(extractReferralCode(new URL('http://localhost:3000/hy?ref=bad%20code'), 'ref')).toBeNull();
  });
});

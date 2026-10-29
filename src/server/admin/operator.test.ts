import { describe, expect, it } from 'vitest';

import { DomainError } from '@/domain/errors';

import { assertWritableFields } from './operator';

/** Возвращает ошибку guard; тест падает, если запись прошла без ошибки. */
function guardError(model: string, data: Record<string, unknown>): DomainError {
  try {
    assertWritableFields(model, data);
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error(`${model} accepted ${JSON.stringify(data)}`);
}

describe('assertWritableFields', () => {
  it('blocks service-owned InstructorProfile verification fields', () => {
    expect(guardError('InstructorProfile', { isVerified: true }).field).toBe('isVerified');
    expect(guardError('InstructorProfile', { verifiedAt: new Date() }).field).toBe('verifiedAt');
  });

  it('blocks CorporateAccount balance', () => {
    expect(guardError('CorporateAccount', { balance: 100 }).field).toBe('balance');
  });

  it('allows ordinary InstructorProfile fields', () => {
    expect(() => assertWritableFields('InstructorProfile', { headline: 'Salsa coach' })).not.toThrow();
  });

  it('applies protection to lowercase model names', () => {
    expect(guardError('instructorprofile', { isVerified: true }).field).toBe('isVerified');
  });

  it('rejects unknown models', () => {
    expect(guardError('NoSuchModel', {}).field).toBe('model');
  });

  it('blocks protected fields written through nested relations', () => {
    expect(guardError('User', { instructor: { update: { isVerified: true } } }).field).toBe('instructor.isVerified');
    expect(guardError('User', { instructor: { upsert: { create: {}, update: { verifiedAt: new Date() } } } }).field).toBe('instructor.verifiedAt');
    expect(guardError('Invoice', { corporateAccount: { update: { balance: 1 } } }).field).toBe('corporateAccount.balance');
  });

  it('allows nested writes to ordinary fields and does not treat filters as writes', () => {
    expect(() => assertWritableFields('User', { instructor: { update: { headline: 'Salsa coach' } } })).not.toThrow();
    expect(() => assertWritableFields('User', { instructor: { update: { where: { isVerified: true }, data: { headline: 'Salsa coach' } } } })).not.toThrow();
  });
});

import { describe, expect, it } from 'vitest';

import { canGoVerified, verificationStatus } from './verification';

describe('canGoVerified', () => {
  it('без документов инструктор не верифицирован', () => {
    expect(canGoVerified([])).toBe(false);
  });

  it('ожидающие и отклонённые документы не дают бейдж', () => {
    expect(canGoVerified([{ status: 'PENDING' }, { status: 'REJECTED' }])).toBe(false);
  });

  it('одного подтверждённого документа достаточно, даже среди отклонённых', () => {
    expect(canGoVerified([{ status: 'REJECTED' }, { status: 'APPROVED' }])).toBe(true);
  });
});

describe('verificationStatus', () => {
  it('без документов — NONE', () => {
    expect(verificationStatus([])).toBe('NONE');
  });

  it('только отклонённые — REJECTED', () => {
    expect(verificationStatus([{ status: 'REJECTED' }])).toBe('REJECTED');
  });

  it('есть ожидающий, подтверждённых нет — PENDING', () => {
    expect(verificationStatus([{ status: 'REJECTED' }, { status: 'PENDING' }])).toBe('PENDING');
  });

  it('подтверждённый документ — VERIFIED, даже если есть ожидающие', () => {
    expect(verificationStatus([{ status: 'PENDING' }, { status: 'APPROVED' }])).toBe('VERIFIED');
  });
});

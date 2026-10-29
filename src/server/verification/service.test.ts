import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Caller } from '@/lib/auth/guards';

const mocks = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(),
    verificationDocument: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    instructorProfile: { findUnique: vi.fn(), update: vi.fn() },
  },
  recordAudit: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/lib/audit', () => ({ recordAudit: mocks.recordAudit }));

import { decideVerificationDocument, submitVerificationDocument } from './service';

const admin = { id: 'admin-1', role: 'ADMIN', email: 'admin@example.com' } as unknown as Caller;
const earlier = new Date('2026-01-10T09:00:00Z');

/** Состояние БД, которое видит транзакция: документ до решения, документы и профиль после обновления. */
function arrange(state: {
  before: string;
  docs: { status: string }[];
  profile: { isVerified: boolean; verifiedAt: Date | null };
}) {
  mocks.db.verificationDocument.findUnique.mockResolvedValue({
    id: 'doc-1',
    instructorId: 'instructor-1',
    status: state.before,
  });
  mocks.db.verificationDocument.update.mockResolvedValue({ id: 'doc-1' });
  mocks.db.verificationDocument.findMany.mockResolvedValue(state.docs);
  mocks.db.instructorProfile.findUnique.mockResolvedValue(state.profile);
  mocks.db.instructorProfile.update.mockResolvedValue({ id: 'instructor-1' });
}

describe('submitVerificationDocument', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('создаёт документ в статусе PENDING для переданного владельца', async () => {
    mocks.db.verificationDocument.create.mockResolvedValue({ id: 'doc-1' });

    await submitVerificationDocument({ instructorId: 'instructor-1', type: 'diploma', storageKey: 'uploads/diploma.pdf' });

    expect(mocks.db.verificationDocument.create).toHaveBeenCalledWith({
      data: { instructorId: 'instructor-1', type: 'diploma', storageKey: 'uploads/diploma.pdf', status: 'PENDING' },
      select: { id: true },
    });
  });

  it('пустой тип отклоняется до записи в БД', async () => {
    await expect(
      submitVerificationDocument({ instructorId: 'instructor-1', type: '  ', storageKey: 'uploads/diploma.pdf' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', field: 'type' });
    expect(mocks.db.verificationDocument.create).not.toHaveBeenCalled();
  });
});

describe('decideVerificationDocument', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.db.$transaction.mockImplementation(async (fn: (tx: typeof mocks.db) => Promise<unknown>) => fn(mocks.db));
    mocks.recordAudit.mockResolvedValue(undefined);
  });

  it('первое подтверждение ставит isVerified и verifiedAt в одной транзакции и пишет аудит', async () => {
    arrange({ before: 'PENDING', docs: [{ status: 'APPROVED' }], profile: { isVerified: false, verifiedAt: null } });

    const result = await decideVerificationDocument({ documentId: 'doc-1', decision: 'APPROVED', actor: admin });

    expect(result).toEqual({ documentId: 'doc-1', instructorId: 'instructor-1', status: 'APPROVED', isVerified: true });
    expect(mocks.db.verificationDocument.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'APPROVED', note: null },
    });
    expect(mocks.db.instructorProfile.update).toHaveBeenCalledWith({
      where: { id: 'instructor-1' },
      data: { isVerified: true, verifiedAt: expect.any(Date) },
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: admin,
        action: 'admin.verification.approve',
        entityType: 'VerificationDocument',
        entityId: 'doc-1',
      }),
    );
  });

  it('повторное подтверждение сохраняет дату первого', async () => {
    arrange({
      before: 'PENDING',
      docs: [{ status: 'APPROVED' }, { status: 'APPROVED' }],
      profile: { isVerified: true, verifiedAt: earlier },
    });

    await decideVerificationDocument({ documentId: 'doc-1', decision: 'APPROVED', actor: admin });

    expect(mocks.db.instructorProfile.update).toHaveBeenCalledWith({
      where: { id: 'instructor-1' },
      data: { isVerified: true, verifiedAt: earlier },
    });
  });

  it('отзыв последнего подтверждённого документа снимает isVerified и verifiedAt и пишет причину', async () => {
    arrange({ before: 'APPROVED', docs: [{ status: 'REJECTED' }], profile: { isVerified: true, verifiedAt: earlier } });

    const result = await decideVerificationDocument({
      documentId: 'doc-1',
      decision: 'REJECTED',
      note: 'Диплом не читается',
      actor: admin,
    });

    expect(result.isVerified).toBe(false);
    expect(mocks.db.instructorProfile.update).toHaveBeenCalledWith({
      where: { id: 'instructor-1' },
      data: { isVerified: false, verifiedAt: null },
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.verification.reject', reason: 'Диплом не читается' }),
    );
  });

  it('отказ по одному документу не снимает бейдж, если остался другой подтверждённый', async () => {
    arrange({
      before: 'PENDING',
      docs: [{ status: 'APPROVED' }, { status: 'REJECTED' }],
      profile: { isVerified: true, verifiedAt: earlier },
    });

    const result = await decideVerificationDocument({ documentId: 'doc-1', decision: 'REJECTED', actor: admin });

    expect(result.isVerified).toBe(true);
    expect(mocks.db.instructorProfile.update).toHaveBeenCalledWith({
      where: { id: 'instructor-1' },
      data: { isVerified: true, verifiedAt: earlier },
    });
  });

  it('аудит пишется только после коммита транзакции', async () => {
    arrange({ before: 'PENDING', docs: [{ status: 'APPROVED' }], profile: { isVerified: false, verifiedAt: null } });
    const order: string[] = [];
    mocks.db.$transaction.mockImplementation(async (fn: (tx: typeof mocks.db) => Promise<unknown>) => {
      const committed = await fn(mocks.db);
      order.push('commit');
      return committed;
    });
    mocks.recordAudit.mockImplementation(async () => {
      order.push('audit');
    });

    await decideVerificationDocument({ documentId: 'doc-1', decision: 'APPROVED', actor: admin });

    expect(order).toEqual(['commit', 'audit']);
  });

  it('сбой транзакции не оставляет записи аудита', async () => {
    arrange({ before: 'PENDING', docs: [{ status: 'APPROVED' }], profile: { isVerified: false, verifiedAt: null } });
    mocks.db.instructorProfile.update.mockRejectedValue(new Error('boom'));

    await expect(decideVerificationDocument({ documentId: 'doc-1', decision: 'APPROVED', actor: admin })).rejects.toThrow(
      'boom',
    );
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it('неизвестный документ: NOT_FOUND, без записей и аудита', async () => {
    mocks.db.verificationDocument.findUnique.mockResolvedValue(null);

    await expect(
      decideVerificationDocument({ documentId: 'missing', decision: 'APPROVED', actor: admin }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(mocks.db.verificationDocument.update).not.toHaveBeenCalled();
    expect(mocks.db.instructorProfile.update).not.toHaveBeenCalled();
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });
});
